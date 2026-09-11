// Consent page: the only place the `consent` flag is set or cleared.
// background.js refuses to read any token while the flag is absent.
const $ = (id) => document.getElementById(id);

const render = async () => {
  const { consent } = await chrome.storage.local.get("consent");
  document.body.dataset.consent = consent === true ? "yes" : "no";
};
const openWeb = () => chrome.runtime.sendMessage({ type: "openWeb" });

$("agree").onclick = async () => {
  await chrome.storage.local.set({ consent: true });
  openWeb();
};
$("decline").onclick = () => window.close();
$("open").onclick = openWeb;
$("revoke").onclick = async () => {
  await chrome.storage.local.remove("consent");
  render();
};
render();
