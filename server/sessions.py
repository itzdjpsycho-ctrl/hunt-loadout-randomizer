"""Small cooperative rooms, persisted in SQLite with revision-checked writes."""

import hashlib
import json
import secrets
import sqlite3
import time
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

Identifier = Annotated[str, Field(max_length=100)]
Traits = Annotated[list[Identifier], Field(max_length=15)]
Ids = Annotated[list[Identifier], Field(max_length=500)]
TTL = 24 * 60 * 60
RECONNECT_GRACE = 60


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Profile(Model):
    rank: int = Field(ge=1, le=100)
    budget: int | None = Field(ge=0, le=100000000)
    acquisition: Literal["purchase"]
    mode: Literal["playable", "chaos", "crazy"]
    team: Literal["solo", "duo", "trio"]
    traits: Traits
    unlocked: Ids
    owned: dict[str, int] = Field(max_length=0)
    excluded: Ids
    preferTraits: bool
    theme: Literal["anything", "cowboy", "quiet", "close", "traps"]
    intensity: Literal["mild", "unhinged", "cursed"]
    challenge: Literal["none", "no-scopes", "bows", "budget300"]
    role: Literal["any", "sniper", "close", "support"]
    customAmmo: bool
    uniqueWeapons: bool
    revealAnimation: bool
    singleRerolls: bool = False


class Build(Model):
    slots: list[Identifier | None] = Field(min_length=10, max_length=10)
    locks: list[bool] = Field(min_length=10, max_length=10)
    lastSeed: str = Field(max_length=256)
    dirty: bool
    name: str = Field(max_length=32)
    rank: int = Field(ge=1, le=100)
    traits: Traits
    role: Literal["any", "sniper", "close", "support"]
    ammo: list[Identifier | None | Annotated[list[Identifier | None], Field(min_length=1, max_length=2)]] = Field(min_length=2, max_length=2)
    mulligan: bool = False
    loadoutMulligans: int = Field(default=0, ge=0, le=10)


class Squad(Model):
    version: str = Field(max_length=40)
    profile: Profile
    builds: list[Build] = Field(min_length=3, max_length=3)
    buildCount: int = Field(ge=2, le=3)
    rollNumber: int = Field(ge=0, le=1000000000)
    seedInput: str = Field(max_length=64)


class CreateRoom(Model):
    name: str = Field(min_length=1, max_length=32)
    control: Literal["own", "everyone"] = "own"
    state: Squad


class JoinRoom(Model):
    name: str = Field(min_length=1, max_length=32)


class UpdateRoom(Model):
    revision: int = Field(ge=0)
    state: Squad


class Rooms:
    def __init__(self, database: Path, catalog: Path):
        self.database = database
        self.catalog_path = catalog

    def initialize(self):
        self.catalog = json.loads(self.catalog_path.read_text(encoding="utf-8"))
        self.items = set(self.catalog["items"])
        self.traits = set(self.catalog["traits"])
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, state TEXT NOT NULL, members TEXT NOT NULL, control TEXT NOT NULL, revision INTEGER NOT NULL, touched REAL NOT NULL)")
            if "activity" not in {row[1] for row in db.execute("PRAGMA table_info(rooms)")}:
                db.execute("ALTER TABLE rooms ADD COLUMN activity TEXT NOT NULL DEFAULT '[]'")

    @contextmanager
    def transaction(self):
        with closing(sqlite3.connect(self.database, timeout=10)) as db, db:
            db.row_factory = sqlite3.Row
            db.execute("BEGIN IMMEDIATE")
            yield db

    def validate(self, state: Squad):
        if state.version != self.catalog["version"]:
            raise HTTPException(422, "Catalog version changed. Reload the page.")
        if state.profile.team != {2: "duo", 3: "trio"}[state.buildCount]:
            raise HTTPException(422, "Squad size does not match the room.")
        if not set(state.profile.unlocked + state.profile.excluded) <= self.items:
            raise HTTPException(422, "Unknown equipment in squad settings.")
        for traits in [state.profile.traits, *(b.traits for b in state.builds)]:
            if not set(traits) <= self.traits or len(set(traits)) != len(traits):
                raise HTTPException(422, "Invalid hunter traits.")
        for build in state.builds:
            if any(item is not None and item not in self.items for item in build.slots):
                raise HTTPException(422, "Unknown equipment in loadout.")
            if any(held and not item for held, item in zip(build.locks, build.slots)):
                raise HTTPException(422, "An empty slot cannot be held.")
            for index, ammo in enumerate(build.ammo):
                if isinstance(ammo, list):
                    pools = self.catalog.get("ammoSlots", {}).get(build.slots[index], [])
                    if len(ammo) != len(pools) or any(value is not None and value not in pool["options"] for value, pool in zip(ammo, pools)):
                        raise HTTPException(422, "Incompatible weapon ammunition slots.")
                    continue
                pools = self.catalog.get("ammoSlots", {}).get(build.slots[index], [])
                allowed = pools[0]["options"] if pools else self.catalog["ammo"].get(build.slots[index], [])
                if ammo is not None and ammo not in allowed:
                    raise HTTPException(422, "Incompatible weapon ammunition.")

    def load(self, db, code):
        row = db.execute("SELECT * FROM rooms WHERE code = ?", (code.upper(),)).fetchone()
        if row is None or row["touched"] < time.time() - TTL:
            raise HTTPException(404, "Room not found or expired. Ask the host for a new code.")
        state = json.loads(row["state"])
        state["profile"].setdefault("singleRerolls", False)
        for build in state["builds"]:
            build.setdefault("loadoutMulligans", 0)
        return {**dict(row), "state": state, "members": json.loads(row["members"]), "activity": json.loads(row["activity"])}

    def write(self, db, room):
        db.execute("UPDATE rooms SET state=?, members=?, revision=?, touched=?, activity=? WHERE code=?", (
            json.dumps(room["state"]), json.dumps(room["members"]), room["revision"], time.time(), json.dumps(room.get("activity", [])), room["code"],
        ))

    def release_disconnected(self, db, room):
        remaining = [p for p in room["members"] if p["seen"] > time.time() - RECONNECT_GRACE]
        if len(remaining) == len(room["members"]):
            return
        room["members"] = remaining
        if remaining and not any(p["host"] for p in remaining):
            remaining[0]["host"] = True
        room["revision"] += 1
        self.write(db, room)

    @staticmethod
    def record_changes(room, member, state):
        old = room["state"]
        changes = []
        for index, (before, after) in enumerate(zip(old["builds"], state["builds"])):
            details = []
            for slot, (a, b) in enumerate(zip(before["slots"], after["slots"])):
                if a != b:
                    details.append({"kind": "item", "slot": slot + 1, "before": a, "after": b})
            for key in ("locks", "ammo", "traits", "rank", "name", "role", "loadoutMulligans"):
                previous = before.get(key, 0) if key == "loadoutMulligans" else before[key]
                if previous != after[key]:
                    details.append({"kind": key, "before": previous, "after": after[key]})
            rolled = before["lastSeed"] != after["lastSeed"]
            if details or rolled:
                lost = sum(bool(x) for x in after["slots"]) < sum(bool(x) for x in before["slots"])
                action = "used a loadout mulligan" if after["loadoutMulligans"] > before.get("loadoutMulligans", 0) and lost else "used a mulligan" if after["mulligan"] and lost else "dealt a loadout" if rolled else "updated"
                changes.append({"hunter": index + 1, "name": after["name"], "action": action, "details": details})
        settings = [key for key in state["profile"] if state["profile"][key] != old["profile"][key]]
        if state["seedInput"] != old["seedInput"]:
            settings.append("seed")
        if changes or settings:
            entry = {"id": room["revision"] + 1, "time": time.time(), "actor": member["name"], "changes": changes, "settings": settings}
            room["activity"] = (room.get("activity", []) + [entry])[-100:]

    @staticmethod
    def member(room, authorization):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Join this room first.")
        digest = hashlib.sha256(authorization[7:].encode()).hexdigest()
        person = next((p for p in room["members"] if secrets.compare_digest(p["secret"], digest)), None)
        if person is None:
            raise HTTPException(401, "Your seat is no longer in this room. Join again.")
        return person

    @staticmethod
    def new_member(name, hunter, host=False):
        token = secrets.token_urlsafe(32)
        return token, {"id": secrets.token_hex(8), "secret": hashlib.sha256(token.encode()).hexdigest(), "name": name.strip() or "Hunter", "hunter": hunter, "host": host, "seen": time.time()}

    @staticmethod
    def view(room, person):
        return {
            "code": room["code"], "revision": room["revision"], "state": room["state"],
            "control": room["control"], "you": person["id"],
            "activity": room.get("activity", []),
            "members": [{k: p[k] for k in ("id", "name", "hunter", "host")} | {"online": p["seen"] > time.time() - 15} for p in room["members"]],
        }


def session_router(rooms: Rooms):
    router = APIRouter(prefix="/api/sessions")

    @router.get("/{code}/invite")
    def invite(code: str, response: Response):
        with rooms.transaction() as db:
            room = rooms.load(db, code)
            previous_host = next((p["name"] for p in room["members"] if p["host"]), "Hunter")
            rooms.release_disconnected(db, room)
            host = next((p["name"] for p in room["members"] if p["host"]), previous_host)
            response.headers["Cache-Control"] = "no-store"
            return {"host": host, "members": len(room["members"]), "capacity": room["state"]["buildCount"]}

    @router.post("", status_code=201)
    def create(body: CreateRoom, response: Response):
        rooms.validate(body.state)
        with rooms.transaction() as db:
            db.execute("DELETE FROM rooms WHERE touched < ?", (time.time() - TTL,))
            if db.execute("SELECT count(*) FROM rooms").fetchone()[0] >= 1000:
                raise HTTPException(503, "Room capacity reached. Please try later.")
            while True:
                code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(8))
                if db.execute("SELECT 1 FROM rooms WHERE code=?", (code,)).fetchone() is None:
                    break
            token, member = rooms.new_member(body.name, 0, True)
            room = {"code": code, "state": body.state.model_dump(), "members": [member], "control": body.control, "revision": 0}
            room["state"]["builds"][0]["name"] = member["name"]
            db.execute("INSERT INTO rooms (code,state,members,control,revision,touched) VALUES (?,?,?,?,?,?)", (code, json.dumps(room["state"]), json.dumps(room["members"]), room["control"], 0, time.time()))
            response.headers["Cache-Control"] = "no-store"
            return {**rooms.view(room, member), "token": token}

    @router.post("/{code}/join")
    def join(code: str, body: JoinRoom, response: Response):
        with rooms.transaction() as db:
            room = rooms.load(db, code)
            rooms.release_disconnected(db, room)
            taken = {p["hunter"] for p in room["members"]}
            seat = next((n for n in range(room["state"]["buildCount"]) if n not in taken), None)
            if seat is None:
                raise HTTPException(409, "This room is full. Ask the host to free a seat.")
            token, member = rooms.new_member(body.name, seat, not room["members"])
            room["members"].append(member)
            room["state"]["builds"][seat]["name"] = member["name"]
            room["revision"] += 1
            rooms.write(db, room)
            response.headers["Cache-Control"] = "no-store"
            return {**rooms.view(room, member), "token": token}

    @router.get("/{code}")
    def read(code: str, response: Response, authorization: str | None = Header(default=None)):
        with rooms.transaction() as db:
            room = rooms.load(db, code)
            member = rooms.member(room, authorization)
            member["seen"] = time.time()
            rooms.release_disconnected(db, room)
            rooms.write(db, room)
            response.headers["Cache-Control"] = "no-store"
            return rooms.view(room, member)

    @router.put("/{code}")
    def update(code: str, body: UpdateRoom, response: Response, authorization: str | None = Header(default=None)):
        rooms.validate(body.state)
        with rooms.transaction() as db:
            room = rooms.load(db, code)
            member = rooms.member(room, authorization)
            member["seen"] = time.time()
            rooms.release_disconnected(db, room)
            if body.revision != room["revision"]:
                raise HTTPException(409, "Another player changed the room. Latest state restored; try your action again.")
            state = body.state.model_dump()
            old = room["state"]
            if state["buildCount"] != old["buildCount"]:
                raise HTTPException(403, "Room size is fixed. Leave and create a new room to change it.")
            if not member["host"] and room["control"] == "own":
                if any(state[key] != old[key] for key in ("profile", "seedInput", "version")) or any(state["builds"][n] != old["builds"][n] for n in range(3) if n != member["hunter"]):
                    raise HTTPException(403, "Only the host can change squad settings or another hunter.")
                if not old["rollNumber"] <= state["rollNumber"] <= old["rollNumber"] + 1:
                    raise HTTPException(403, "Invalid roll sequence.")
            member["seen"] = time.time()
            rooms.record_changes(room, member, state)
            room["state"] = state
            room["revision"] += 1
            rooms.write(db, room)
            response.headers["Cache-Control"] = "no-store"
            return rooms.view(room, member)

    @router.delete("/{code}/members/{member_id}")
    def leave(code: str, member_id: str, authorization: str | None = Header(default=None)):
        with rooms.transaction() as db:
            room = rooms.load(db, code)
            member = rooms.member(room, authorization)
            if member_id != member["id"] and not member["host"]:
                raise HTTPException(403, "Only the host can remove another player.")
            if not any(p["id"] == member_id for p in room["members"]):
                raise HTTPException(404, "Player has already left.")
            room["members"] = [p for p in room["members"] if p["id"] != member_id]
            if not room["members"]:
                db.execute("DELETE FROM rooms WHERE code=?", (room["code"],))
            else:
                if not any(p["host"] for p in room["members"]):
                    room["members"][0]["host"] = True
                room["revision"] += 1
                rooms.write(db, room)
            return {"ok": True}

    return router
