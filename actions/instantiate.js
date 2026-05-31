import { CONFIG } from "../config.js";
import { APP_STATE } from "../utils/state.js";
import { openActionModal } from "../utils/modal.js";
import { sendTransaction } from "./radix.js";

function instantiateManifest({ maxPerTx, multisig, dailyCap, agentName, notarizerAccount }) {
  const account = APP_STATE.activeAccount.address;
  const assets = CONFIG.ALLOWED_ASSETS.map(a =>
    `Tuple("${a.name}", Address("${a.address}"))`
  ).join(", ");

  return `
CALL_FUNCTION
    Address("${CONFIG.PACKAGE_ADDRESS}")
    "PolicyVault"
    "instantiate"
    Decimal("${maxPerTx}")
    Decimal("${multisig}")
    Decimal("${dailyCap}")
    Array<Tuple>(Tuple("owner", Address("${account}")))
    "${agentName}"
    Address("${CONFIG.DAPP_DEFINITION}")
    Address("${CONFIG.DEV_FEE_COLLECTOR}")
    Array<Tuple>(${assets})
    Address("${notarizerAccount}")
;
CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;
`;
}
async function getInstantiateDetails(intentHash) {
  await new Promise(r => setTimeout(r, 5000));

  const response = await fetch(`${CONFIG.GATEWAY_URL}/transaction/committed-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent_hash: intentHash,
      opt_ins: { balance_changes: true, receipt_state_changes: true }
    })
  });

  const data = await response.json();
  const newGlobalEntities = data?.transaction?.receipt?.state_updates?.new_global_entities || [];

  const componentAddress = newGlobalEntities.find(e =>
    e.entity_type === "GlobalGenericComponent"
  )?.entity_address || null;

  const ownerBadgeAddress = newGlobalEntities.find(e =>
    e.entity_type === "GlobalFungibleResource"
  )?.entity_address || null;

  const agentBadgeAddress = newGlobalEntities.find(e =>
    e.entity_type === "GlobalNonFungibleResource"
  )?.entity_address || null;

  return {
    componentAddress,
    ownerBadgeAddress,
    agentBadgeAddress,
    badgeLocalId: "#1#",
  };
}

function showInstantiateResult(details, notarizerAccount) {
  const envContent = `COMPONENT_ADDRESS=${details.componentAddress}
BADGE_RESOURCE_ADDRESS=${details.agentBadgeAddress}
BADGE_LOCAL_ID=${details.badgeLocalId}
OWNER_BADGE_ADDRESS=${details.ownerBadgeAddress}`;

  openActionModal({
    title: "✅ Agent Wallet Instantiated",
    content: `
      <div style="display:flex;flex-direction:column;gap:16px;margin-top:8px;">
        <p style="color:#2ecc71;font-size:14px;margin:0;">
          ✅ Your Agent Wallet has been created successfully.
        </p>
        <p style="font-size:13px;color:#8b949e;margin:0;">
          Save the following information — you will need it to configure your agent.
        </p>

        <div>
          <label style="font-size:12px;color:#8b949e;">Component Address</label>
          <input readonly value="${details.componentAddress}"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:#2ecc71;border:1px solid #333;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;"
            onclick="this.select()"/>
        </div>

        <div>
          <label style="font-size:12px;color:#8b949e;">Owner Badge Address (PVOB)</label>
          <input readonly value="${details.ownerBadgeAddress}"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:#f39c12;border:1px solid #333;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;"
            onclick="this.select()"/>
        </div>

        <div>
          <label style="font-size:12px;color:#8b949e;">Agent Badge Address (AWB)</label>
          <input readonly value="${details.agentBadgeAddress}"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:#3498db;border:1px solid #333;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;"
            onclick="this.select()"/>
        </div>

        <div>
          <label style="font-size:12px;color:#8b949e;">Badge Local ID</label>
          <input readonly value="${details.badgeLocalId}"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;"
            onclick="this.select()"/>
        </div>

        <div>
          <label style="font-size:12px;color:#8b949e;">Notarizer Account</label>
          <input readonly value="${notarizerAccount}"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;"
            onclick="this.select()"/>
        </div>

        <div>
          <label style="font-size:12px;color:#8b949e;">📋 .env file — copy this to your agent configuration</label>
          <textarea readonly rows="5"
            style="width:100%;padding:8px;border-radius:8px;background:#0a0a0a;color:#2ecc71;border:1px solid #2ecc71;box-sizing:border-box;font-family:monospace;font-size:11px;margin-top:4px;resize:none;"
            onclick="this.select()">${envContent}</textarea>
        </div>

        <p style="font-size:11px;color:#555;margin:0;">
          ⚠️ The notarizer address and private key come from your SDK keystore — do not share them.
        </p>
      </div>
    `,
    confirmText: "Done",
    onConfirm: () => {},
  });
}

export async function instantiate() {
  if (!APP_STATE.activeAccount) {
    console.error("No active account");
    return;
  }

  openActionModal({
    title: "Instantiate Agent Wallet",
    content: `
      <div style="display:flex;flex-direction:column;gap:16px;margin-top:8px;">
        <div>
          <label style="font-size:13px;color:#8b949e;">Agent Name</label>
          <p style="font-size:12px;color:#555;margin:2px 0 6px;">A name to identify your agent.</p>
          <input id="inst-name" type="text" placeholder="my-trading-agent"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:13px;color:#8b949e;">Notarizer Account</label>
          <p style="font-size:12px;color:#555;margin:2px 0 6px;">The agent notarizer account address generated by the SDK (agent-wallet init).</p>
          <input id="inst-notarizer" type="text" placeholder="account_rdx1..."
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:13px;color:#8b949e;">Max per Transaction</label>
          <p style="font-size:12px;color:#555;margin:2px 0 6px;">Maximum amount the agent can spend in a single transaction.</p>
          <input id="inst-max-tx" type="number" placeholder="400" min="0" step="1"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:13px;color:#8b949e;">Multisig Threshold</label>
          <p style="font-size:12px;color:#555;margin:2px 0 6px;">Maximum the agent and owner can spend together in one TX.</p>
          <input id="inst-multisig" type="number" placeholder="1000" min="0" step="1"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;"/>
        </div>
        <div>
          <label style="font-size:13px;color:#8b949e;">Daily Cap</label>
          <p style="font-size:12px;color:#555;margin:2px 0 6px;">Maximum total spending allowed per day.</p>
          <input id="inst-daily" type="number" placeholder="10000" min="0" step="1"
            style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;box-sizing:border-box;"/>
        </div>
      </div>
    `,
    confirmText: "Instantiate",
onConfirm: async () => {
  const agentName        = document.getElementById("inst-name").value.trim();
  const notarizerAccount = document.getElementById("inst-notarizer").value.trim();
  const maxPerTx         = document.getElementById("inst-max-tx").value.trim();
  const multisig         = document.getElementById("inst-multisig").value.trim();
  const dailyCap         = document.getElementById("inst-daily").value.trim();

  if (!agentName || !notarizerAccount || !maxPerTx || !multisig || !dailyCap) {
    console.error("All fields required for instantiate");
    return;
  }

  if (parseFloat(maxPerTx) > parseFloat(multisig)) {
    console.error("Max per TX cannot exceed Multisig Threshold");
    return;
  }

  if (parseFloat(multisig) > parseFloat(dailyCap)) {
    console.error("Multisig Threshold cannot exceed Daily Cap");
    return;
  }

  const manifest = instantiateManifest({
    maxPerTx, multisig, dailyCap, agentName, notarizerAccount
  });

  console.log("INSTANTIATE MANIFEST:", manifest);
  const result = await sendTransaction(manifest);

  if (result) {
    const intentHash = result.transactionIntentHash;

    // Mostrar mensaje de espera
    openActionModal({
      title: "⏳ Processing...",
      content: `
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-top:16px;">
          <div style="font-size:32px;">⏳</div>
          <p style="color:#8b949e;font-size:14px;text-align:center;margin:0;">
            Transaction confirmed. Fetching your agent configuration...<br/>
            This may take a few seconds.
          </p>
        </div>
      `,
      hideConfirm: true,
    });

    const details = await getInstantiateDetails(intentHash);
    console.log("Instantiate details:", details);
    showInstantiateResult(details, notarizerAccount);
  }
}
  });
}
