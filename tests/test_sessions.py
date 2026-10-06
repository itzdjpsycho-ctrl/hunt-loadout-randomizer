import copy
import json
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

from fastapi.testclient import TestClient

from server.main import SITE, create_app


def squad():
    catalog = json.loads((SITE / "session-catalog.json").read_text())
    profile = dict(rank=100, budget=None, acquisition="purchase", mode="chaos", team="trio", traits=[], unlocked=[], owned={}, excluded=[], preferTraits=True, theme="anything", intensity="unhinged", challenge="none", role="any", customAmmo=False, uniqueWeapons=False, revealAnimation=False)
    build = dict(slots=[None] * 10, locks=[False] * 10, lastSeed="", dirty=False, name="", rank=100, traits=[], role="any", ammo=[None, None], mulligan=False, loadoutMulligans=0)
    return dict(version=catalog["version"], profile=profile, builds=[copy.deepcopy(build) for _ in range(3)], buildCount=3, rollNumber=0, seedInput="")


class SessionTests(unittest.TestCase):
    def setUp(self):
        artifacts = SITE.parent / "artifacts"
        artifacts.mkdir(exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(dir=artifacts)
        self.database = Path(self.directory.name) / "sessions.db"
        self.client = TestClient(create_app(database=self.database))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.directory.cleanup()

    def create(self, **changes):
        response = self.client.post("/api/sessions", json={"name": "Host", "state": squad(), **changes})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    @staticmethod
    def auth(member):
        return {"Authorization": "Bearer " + member["token"]}

    def join(self, room, name="Partner"):
        response = self.client.post(f'/api/sessions/{room["code"]}/join', json={"name": name})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def read(self, member):
        response = self.client.get('/api/sessions/' + member["code"], headers=self.auth(member))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")
        return response.json()

    def put(self, member, state, revision):
        return self.client.put('/api/sessions/' + member["code"], headers=self.auth(member), json={"state": state, "revision": revision})

    def test_invite_preview_exposes_only_host_and_capacity(self):
        host = self.create()
        path = f'/api/sessions/{host["code"]}/invite'
        response = self.client.get(path)
        self.assertEqual(response.json(), {"host": "Host", "members": 1, "capacity": 3})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.join(host)
        self.join(host, "Third")
        self.assertEqual(self.client.get(path).json()["members"], 3)
        self.assertEqual(self.client.get('/api/sessions/XXXXXXXX/invite').status_code, 404)
        self.assertEqual(self.client.get('/api/sessions/' + host["code"]).status_code, 401)

    def age_member(self, room, member, seconds):
        import time
        with closing(sqlite3.connect(self.database)) as db, db:
            members = json.loads(db.execute("SELECT members FROM rooms WHERE code=?", (room["code"],)).fetchone()[0])
            for person in members:
                if person["id"] == member["you"]:
                    person["seen"] = time.time() - seconds
            db.execute("UPDATE rooms SET members=? WHERE code=?", (json.dumps(members), room["code"]))

    def test_disconnected_host_transfers_control_and_frees_seat(self):
        host = self.create()
        guest = self.join(host)
        self.age_member(host, host, 61)
        view = self.read(guest)
        self.assertEqual(len(view["members"]), 1)
        self.assertTrue(view["members"][0]["host"])
        self.assertEqual(view["state"], guest["state"])
        self.assertEqual(self.client.get('/api/sessions/' + host["code"], headers=self.auth(host)).status_code, 401)
        replacement = self.join(host, "Replacement")
        self.assertEqual(next(p["hunter"] for p in replacement["members"] if p["id"] == replacement["you"]), 0)

    def test_reconnect_grace_and_empty_party_recovery(self):
        host = self.create()
        guest = self.join(host)
        self.age_member(host, guest, 30)
        self.assertEqual(len(self.read(host)["members"]), 2)
        self.assertEqual(self.read(guest)["you"], guest["you"])
        self.age_member(host, guest, 61)
        self.age_member(host, host, 61)
        preview = self.client.get(f'/api/sessions/{host["code"]}/invite').json()
        self.assertEqual(preview["members"], 0)
        replacement = self.join(host)
        self.assertTrue(replacement["members"][0]["host"])

    def test_join_authentication_capacity_and_seat_reuse(self):
        host = self.create()
        guest = self.join(host)
        third = self.join(host, "Third")
        self.assertEqual([b["name"] for b in third["state"]["builds"]], ["Host", "Partner", "Third"])
        self.assertEqual(self.read(host)["state"], third["state"])
        self.assertEqual([p["hunter"] for p in third["members"]], [0, 1, 2])
        self.assertEqual(self.client.post(f'/api/sessions/{host["code"]}/join', json={"name": "Fourth"}).status_code, 409)
        self.assertEqual(self.client.get('/api/sessions/' + host["code"]).status_code, 401)
        other = self.create()
        self.assertEqual(self.client.get('/api/sessions/' + other["code"], headers=self.auth(guest)).status_code, 401)
        visible = self.read(host)
        self.assertNotIn('"secret"', json.dumps(visible))
        self.assertNotIn(host["token"], json.dumps(visible))
        self.assertEqual(self.client.delete(f'/api/sessions/{host["code"]}/members/{guest["you"]}', headers=self.auth(host)).status_code, 200)
        self.assertEqual(self.client.get('/api/sessions/' + host["code"], headers=self.auth(guest)).status_code, 401)
        replacement = self.join(host, " Replacement ")
        self.assertEqual(replacement["state"]["builds"][1]["name"], "Replacement")
        self.assertEqual(next(p["hunter"] for p in replacement["members"] if p["id"] == replacement["you"]), 1)

    def test_guests_can_change_only_their_hunter(self):
        host = self.create()
        guest = self.join(host)
        state = copy.deepcopy(guest["state"])
        state["builds"][0]["name"] = "Not yours"
        self.assertEqual(self.put(guest, state, guest["revision"]).status_code, 403)
        state = copy.deepcopy(guest["state"])
        state["profile"]["mode"] = "crazy"
        self.assertEqual(self.put(guest, state, guest["revision"]).status_code, 403)
        state = copy.deepcopy(guest["state"])
        state["builds"][1]["name"] = "My hunter"
        response = self.put(guest, state, guest["revision"])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.read(host)["state"]["builds"][1]["name"], "My hunter")
        activity = self.read(host)["activity"]
        self.assertEqual(len(activity), 1)
        self.assertEqual(activity[0]["actor"], "Partner")
        self.assertEqual(activity[0]["changes"][0]["hunter"], 2)
        self.assertEqual(activity[0]["changes"][0]["details"], [{"kind": "name", "before": "Partner", "after": "My hunter"}])
        with TestClient(create_app(database=self.database)) as restarted:
            self.assertEqual(restarted.get('/api/sessions/' + host["code"], headers=self.auth(host)).json()["activity"], activity)
        self.assertEqual(self.client.delete(f'/api/sessions/{host["code"]}/members/{host["you"]}', headers=self.auth(guest)).status_code, 403)

    def test_conflicting_writes_cannot_overwrite_a_newer_revision(self):
        host = self.create()
        a = copy.deepcopy(host["state"])
        b = copy.deepcopy(a)
        a["builds"][0]["name"] = "A"
        b["builds"][0]["name"] = "B"
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda state: self.put(host, state, host["revision"]), [a, b]))
        self.assertEqual(sorted(r.status_code for r in responses), [200, 409])
        winner = next(r.json()["state"] for r in responses if r.status_code == 200)
        self.assertEqual(self.read(host)["state"], winner)

    def test_room_survives_restart_and_transfers_host(self):
        host = self.create()
        guest = self.join(host)
        with TestClient(create_app(database=self.database)) as restarted:
            self.assertEqual(restarted.get('/api/sessions/' + host["code"], headers=self.auth(guest)).json()["state"], guest["state"])
        self.client.delete(f'/api/sessions/{host["code"]}/members/{host["you"]}', headers=self.auth(host))
        view = self.read(guest)
        self.assertTrue(view["members"][0]["host"])
        self.client.delete(f'/api/sessions/{host["code"]}/members/{guest["you"]}', headers=self.auth(guest))
        self.assertEqual(self.client.get('/api/sessions/' + host["code"], headers=self.auth(guest)).status_code, 404)

    def test_ammo_slots_round_trip_and_reject_wrong_barrel(self):
        state = squad()
        state["profile"]["customAmmo"] = True
        state["builds"][0]["slots"][:2] = ["sparks", "lemat"]
        state["builds"][0]["ammo"] = [["fmj-ammo", "poison-ammo"], ["fmj-ammo", "slug"]]
        host = self.create(state=state)
        self.assertEqual(self.read(host)["state"]["builds"][0]["ammo"], state["builds"][0]["ammo"])
        for ammo in (["slug", "fmj-ammo"], ["fmj-ammo"], ["unknown", None]):
            invalid = copy.deepcopy(state)
            invalid["builds"][0]["ammo"][1] = ammo
            self.assertEqual(self.put(host, invalid, host["revision"]).status_code, 422)

    def test_loadout_mulligan_counter_syncs_and_legacy_defaults(self):
        legacy = squad()
        for build in legacy["builds"]:
            del build["loadoutMulligans"]
        host = self.create(state=legacy)
        self.assertTrue(all(build["loadoutMulligans"] == 0 for build in host["state"]["builds"]))
        with closing(sqlite3.connect(self.database)) as db, db:
            persisted = copy.deepcopy(host["state"])
            for build in persisted["builds"]:
                del build["loadoutMulligans"]
            db.execute("UPDATE rooms SET state=? WHERE code=?", (json.dumps(persisted), host["code"]))
        guest = self.join(host)
        state = copy.deepcopy(guest["state"])
        state["builds"][1]["loadoutMulligans"] = 2
        state["builds"][1]["mulligan"] = True
        response = self.put(guest, state, guest["revision"])
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.read(host)["state"]["builds"][1]["loadoutMulligans"], 2)
        for count in (-1, 11, "2"):
            invalid = copy.deepcopy(state)
            invalid["builds"][1]["loadoutMulligans"] = count
            self.assertEqual(self.put(guest, invalid, response.json()["revision"]).status_code, 422)

    def test_schema_catalog_size_and_expiry(self):
        host = self.create()
        for field, value in (("slots", ["unknown"] * 10), ("slots", []), ("ammo", ["unknown", None]), ("traits", ["unknown"]), ("rank", 0)):
            state = copy.deepcopy(host["state"])
            state["builds"][0][field] = value
            self.assertEqual(self.put(host, state, host["revision"]).status_code, 422, field)
        state = copy.deepcopy(host["state"])
        state["buildCount"] = 2
        state["profile"]["team"] = "duo"
        self.assertEqual(self.put(host, state, host["revision"]).status_code, 403)
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("UPDATE rooms SET touched=0")
        self.assertEqual(self.client.get('/api/sessions/' + host["code"], headers=self.auth(host)).status_code, 404)

    def test_everyone_mode_allows_shared_controls(self):
        host = self.create(control="everyone")
        guest = self.join(host)
        state = copy.deepcopy(guest["state"])
        state["profile"]["mode"] = "crazy"
        state["builds"][0]["name"] = "Shared hunter"
        self.assertEqual(self.put(guest, state, guest["revision"]).status_code, 200)
        self.assertEqual(self.read(host)["state"], state)


if __name__ == "__main__":
    unittest.main()
