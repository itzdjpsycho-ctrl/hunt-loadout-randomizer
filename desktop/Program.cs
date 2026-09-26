using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("Dead Man's Hand")]
[assembly: AssemblyDescription("Hunt: Showdown 1896 Chaos Loadout Randomizer")]
[assembly: AssemblyProduct("Dead Man's Hand")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class Program
{
    internal static string AppFolder;
    internal static string DataFolder;
    internal static string TestReport;
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr LoadLibrary(string path);

    [STAThread]
    private static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        try
        {
            if (args.Length == 2 && args[0] == "--self-test") TestReport = Path.GetFullPath(args[1]);
            var root = TestReport == null
                ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DeadMansHand")
                : Path.Combine(Path.GetDirectoryName(TestReport), "desktop-test-data");
            DataFolder = root;
            string fingerprint;
            using (var hash = SHA256.Create())
            using (var input = File.OpenRead(Assembly.GetExecutingAssembly().Location))
                fingerprint = BitConverter.ToString(hash.ComputeHash(input)).Replace("-", "").Substring(0, 16);
            AppFolder = Path.Combine(root, "app", fingerprint);
            Directory.CreateDirectory(AppFolder);
            foreach (string file in new[] { "Chaos-Loadout.html", "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll", "WebView2-LICENSE.txt", "WebView2-NOTICE.txt", "engine-tests.js", "desktop-smoke.js" })
            {
                string path = Path.Combine(AppFolder, file);
                if (!File.Exists(path))
                {
                    using (var source = Assembly.GetExecutingAssembly().GetManifestResourceStream(file))
                    using (var target = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.Read))
                    {
                        if (source == null) throw new IOException("Missing embedded file: " + file);
                        source.CopyTo(target);
                    }
                }
            }
            AppDomain.CurrentDomain.AssemblyResolve += delegate(object sender, ResolveEventArgs e)
            {
                string name = new AssemblyName(e.Name).Name;
                if (name != "Microsoft.Web.WebView2.Core" && name != "Microsoft.Web.WebView2.WinForms") return null;
                return Assembly.LoadFrom(Path.Combine(AppFolder, name + ".dll"));
            };
            if (LoadLibrary(Path.Combine(AppFolder, "WebView2Loader.dll")) == IntPtr.Zero)
                throw new InvalidOperationException("Could not load the desktop browser component. Windows error " + Marshal.GetLastWin32Error());
            Launch();
        }
        catch (Exception e) { Fail(e); }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static void Launch() { Application.Run(new MainWindow()); }

    internal static void Fail(Exception error)
    {
        if (TestReport != null)
            File.WriteAllText(TestReport, "FAIL\n" + error.ToString());
        else
            MessageBox.Show("Dead Man's Hand could not start.\n\n" + error.Message +
                "\n\nThis app requires the Microsoft Edge WebView2 Runtime. If it is missing, install it from https://developer.microsoft.com/microsoft-edge/webview2/", "Dead Man's Hand", MessageBoxButtons.OK, MessageBoxIcon.Error);
        Environment.ExitCode = 1;
    }
}

internal sealed class MainWindow : Form
{
    private readonly WebView2 browser = new WebView2();
    private readonly Timer startupTimeout = new Timer();
    private bool testsStarted;
    private const string Home = "https://deadmanshand.example/Chaos-Loadout.html";

    internal MainWindow()
    {
        Text = "Dead Man's Hand | Hunt Chaos Loadouts";
        ClientSize = new Size(1380, 950);
        MinimumSize = new Size(420, 650);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(21, 22, 19);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        browser.Dock = DockStyle.Fill;
        browser.DefaultBackgroundColor = BackColor;
        Controls.Add(browser);
        if (Program.TestReport != null) { ShowInTaskbar = false; Opacity = 0; }
        Shown += async delegate { await InitializeBrowser(); };
        FormClosed += delegate { startupTimeout.Dispose(); browser.Dispose(); };
    }

    private async Task InitializeBrowser()
    {
        try
        {
            startupTimeout.Interval = 60000;
            startupTimeout.Tick += delegate
            {
                startupTimeout.Stop();
                Program.Fail(new TimeoutException("The desktop app did not finish loading within 60 seconds."));
                Close();
            };
            startupTimeout.Start();
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(Program.DataFolder, "browser"));
            await browser.EnsureCoreWebView2Async(environment);
            browser.CoreWebView2.SetVirtualHostNameToFolderMapping("deadmanshand.example", Program.AppFolder, CoreWebView2HostResourceAccessKind.Deny);
            browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            browser.CoreWebView2.Settings.AreDevToolsEnabled = Program.TestReport != null;
            browser.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e)
            {
                e.Handled = true;
                OpenExternal(e.Uri);
            };
            browser.CoreWebView2.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e)
            {
                Uri target;
                if (Uri.TryCreate(e.Uri, UriKind.Absolute, out target) && target.Scheme == "https" && target.Host == "deadmanshand.example") return;
                e.Cancel = true;
                OpenExternal(e.Uri);
            };
            browser.CoreWebView2.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e)
            {
                e.Handled = true;
                using (var save = new SaveFileDialog())
                {
                    save.Title = "Save your Chaos loadout";
                    save.Filter = "JSON loadout (*.json)|*.json";
                    save.DefaultExt = "json";
                    save.FileName = Path.GetFileName(e.ResultFilePath);
                    save.OverwritePrompt = true;
                    if (save.ShowDialog(this) == DialogResult.OK) e.ResultFilePath = save.FileName;
                    else e.Cancel = true;
                }
            };
            browser.CoreWebView2.NavigationCompleted += async delegate(object sender, CoreWebView2NavigationCompletedEventArgs e)
            {
                if (!e.IsSuccess) { Program.Fail(new IOException("The app page could not load: " + e.WebErrorStatus)); Close(); return; }
                if (Program.TestReport == null) { startupTimeout.Stop(); return; }
                if (testsStarted) return;
                testsStarted = true;
                try { await SelfTest(); }
                catch (Exception error) { Program.Fail(error); }
                finally { startupTimeout.Stop(); Close(); }
            };
            browser.CoreWebView2.Navigate(Home);
        }
        catch (Exception e) { startupTimeout.Stop(); Program.Fail(e); Close(); }
    }

    private static void OpenExternal(string address)
    {
        Uri target;
        if (!Uri.TryCreate(address, UriKind.Absolute, out target) || (target.Scheme != "https" && target.Scheme != "http")) return;
        if (Program.TestReport == null) Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
    }

    private async Task SelfTest()
    {
        string ready = await browser.CoreWebView2.ExecuteScriptAsync("!!window.ChaosApp && !!window.ChaosEngine");
        if (ready != "true") throw new Exception("The packaged app failed to initialize.");
        await browser.CoreWebView2.ExecuteScriptAsync("document.body.insertAdjacentHTML('beforeend','<pre id=\"results\" hidden></pre>');");
        await browser.CoreWebView2.ExecuteScriptAsync(File.ReadAllText(Path.Combine(Program.AppFolder, "engine-tests.js")));
        string engine = await browser.CoreWebView2.ExecuteScriptAsync("JSON.parse(document.getElementById('results').textContent)");
        string enginePass = await browser.CoreWebView2.ExecuteScriptAsync("document.body.dataset.status === 'PASS'");
        if (enginePass != "true") throw new Exception("Packaged engine tests failed: " + engine);
        await browser.CoreWebView2.ExecuteScriptAsync(File.ReadAllText(Path.Combine(Program.AppFolder, "desktop-smoke.js")));
        string smoke = "null";
        for (int n = 0; n < 600; n++)
        {
            smoke = await browser.CoreWebView2.ExecuteScriptAsync("window.desktopSmokeResult || null");
            if (smoke != "null") break;
            await Task.Delay(100);
        }
        string smokePass = await browser.CoreWebView2.ExecuteScriptAsync("window.desktopSmokeResult && window.desktopSmokeResult.status === 'PASS'");
        using (var preview = File.Create(Path.ChangeExtension(Program.TestReport, ".png")))
            await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, preview);
        if (smokePass != "true") throw new Exception("Desktop interaction tests failed: " + smoke);
        foreach (string panel in new[] { "squad-options", "library" })
        {
            await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('" + panel + "-open').click();");
            using (var panelPreview = File.Create(Path.ChangeExtension(Program.TestReport, null) + "-" + panel + ".png"))
                await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, panelPreview);
            await browser.CoreWebView2.ExecuteScriptAsync("document.getElementById('" + panel + "-dialog').close();");
        }
        File.WriteAllText(Program.TestReport, "{\"status\":\"PASS\",\"runtime\":\"" + browser.CoreWebView2.Environment.BrowserVersionString + "\",\"engine\":" + engine + ",\"desktop\":" + smoke + "}");
    }
}
