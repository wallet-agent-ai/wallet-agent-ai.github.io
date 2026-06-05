import { CONFIG } from "../config.js";
import { APP_STATE } from "../utils/state.js";
import { openActionModal } from "../utils/modal.js";

async function fetchComponentBalances() {
  const response = await fetch(
    `${CONFIG.GATEWAY_URL}/state/entity/details`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [APP_STATE.componentAddress],
        aggregation_level: "Vault",
        opt_ins: {
          explicit_metadata: ["name", "symbol"]
        }
      })
    }
  );
  const data = await response.json();
  const fungibles = data?.items?.[0]?.fungible_resources?.items || [];
  return fungibles.map(resource => {
    const metadata = resource.explicit_metadata?.items || [];
    const name     = metadata.find(m => m.key === "name")?.value?.typed?.value   || "Unknown";
    const symbol   = metadata.find(m => m.key === "symbol")?.value?.typed?.value || "???";
    const amount   = parseFloat(resource.vaults?.items?.[0]?.amount || 0).toFixed(4);
    return { name, symbol, amount };
  });
}

async function fetchComponentState() {
  const response = await fetch(
    `${CONFIG.GATEWAY_URL}/state/entity/details`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [APP_STATE.componentAddress],
      })
    }
  );
  const data = await response.json();
  const fields = data?.items?.[0]?.details?.state?.fields ?? [];
  const getField = name => fields.find(f => f.field_name === name)?.value;

  return {
    awbResource:      getField("agent_badge_manager")      ?? "—",
    pvobResource:     getField("owner_badge_address")      ?? "—",
    notarizerAccount: getField("notarizer_account")        ?? "—",
  };
}

export async function viewBalances() {
  if (!APP_STATE.componentAddress) {
    console.error("Missing componentAddress for viewBalances");
    return;
  }

  const [balances, state] = await Promise.all([
    fetchComponentBalances(),
    fetchComponentState(),
  ]);

  const rows = balances.length > 0
    ? balances.map(b => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:10px;border-radius:8px;background:#0a0f1a;border:1px solid #1f2937;">
          <span style="font-size:13px;color:#8b949e;">${b.symbol} — ${b.name}</span>
          <span style="font-size:14px;font-weight:600;color:#276ff5;">${b.amount}</span>
        </div>
      `).join("")
    : `<p style="color:#555;font-size:13px;text-align:center;">No assets found in agent wallet.</p>`;

  const addressBlock = (label, value, type = "resource") => `
    <div style="padding:10px;border-radius:8px;background:#0a0f1a;border:1px solid #1f2937;">
      <p style="font-size:11px;color:#555;margin:0 0 4px;">${label}</p>
      <p style="font-size:11px;font-family:monospace;color:#8b949e;margin:0;word-break:break-all;">${value}</p>
      ${value !== "—" ? `
        <a href="${CONFIG.DASHBOARD_URL}/${type}/${value}" target="_blank"
          style="display:inline-block;margin-top:4px;font-size:11px;color:#276ff5;text-decoration:none;">
          View on Dashboard ↗
        </a>` : ''}
    </div>`;

  const explorerUrl = `${CONFIG.DASHBOARD_URL}/component/${APP_STATE.componentAddress}`;

  openActionModal({
    title: "Agent Wallet Balances",
    hideConfirm: true,
    content: `
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">

        ${rows}

        <div style="margin-top:4px;border-top:1px solid #1f2937;padding-top:8px;">
          <p style="font-size:11px;color:#555;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;">
            Contract Info
          </p>
        </div>

        ${addressBlock("Component Address", APP_STATE.componentAddress, "component")}
        ${addressBlock("Agent Wallet Badge (AWB)", state.awbResource, "resource")}
        ${addressBlock("Policy Vault Owner Badge (PVOB)", state.pvobResource, "resource")}
        ${addressBlock("Notarizer Account", state.notarizerAccount, "account")}

        <a href="${explorerUrl}" target="_blank"
          style="display:inline-block;margin-top:4px;font-size:12px;color:#276ff5;
            text-decoration:none;text-align:center;">
          View Component on Radix Dashboard ↗
        </a>

      </div>
    `,
  });
}
