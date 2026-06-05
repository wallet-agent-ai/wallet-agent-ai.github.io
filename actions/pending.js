import { CONFIG } from "../config.js";
import { APP_STATE } from "../utils/state.js";
import { openActionModal } from "../utils/modal.js";
import { sendTransaction } from "./radix.js";

// ─── Get Pending Action ───────────────────────────────────────────────────────
// Llama a get_pending_action del v2 — devuelve el enum PendingAction o null

export async function getPendingTransfer() {
  if (!APP_STATE.componentAddress || !APP_STATE.ownerBadgeAddress) return null;

  const manifest = `
CALL_METHOD Address("${APP_STATE.activeAccount.address}") "create_proof_of_amount" Address("${APP_STATE.ownerBadgeAddress}") Decimal("1") ;
CALL_METHOD Address("${APP_STATE.componentAddress}") "get_pending_action" ;
`;

  const response = await fetch(
    `${CONFIG.GATEWAY_URL}/transaction/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manifest,
        start_epoch_inclusive: 1,
        end_epoch_exclusive: 100,
        nonce: Math.floor(Math.random() * 1000000000),
        signer_public_keys: [],
        notary_public_key: {
          key_type: "EddsaEd25519",
          key_hex: "0000000000000000000000000000000000000000000000000000000000000001"
        },
        notary_is_signatory: true,
        tip_percentage: 0,
        flags: {
          use_free_credit: true,
          assume_all_signature_proofs: true,
          skip_epoch_check: true
        }
      })
    }
  );

  const data = await response.json();
  const output = data?.receipt?.output?.[1]?.programmatic_json;

  // Option::None — no hay acción pendiente
  if (!output || output.variant_id === "0") return null;

  // Option::Some — hay una acción pendiente
  // El inner es el enum PendingAction con sus variantes
  const inner = output?.fields?.[0];
  if (!inner) return null;

  return parsePendingAction(inner);
}

// ─── Parse PendingAction enum ─────────────────────────────────────────────────
// variant_id: 0 = Transfer, 1 = WhitelistAdd, 2 = UpdateLimits, 3 = Custom

function parsePendingAction(action) {
  const variantId = parseInt(action.variant_id ?? "-1");
  const fields = action.fields || [];

  switch (variantId) {
    case 0: { // Transfer(PendingTransfer)
      const transferFields = fields[0]?.fields || [];
      return {
        type: "Transfer",
        to:               transferFields[0]?.value,
        amount:           transferFields[1]?.value,
        asset:            transferFields[2]?.value,
        reason:           transferFields[3]?.value,
        requestedAtEpoch: transferFields[4]?.value,
      };
    }
    case 1: { // WhitelistAdd
      return {
        type:    "WhitelistAdd",
        name:    fields[0]?.value,
        address: fields[1]?.value,
        reason:  fields[2]?.value,
      };
    }
    case 2: { // UpdateLimits
      return {
        type:               "UpdateLimits",
        maxPerTransaction:  fields[0]?.value,
        multisigThreshold:  fields[1]?.value,
        dailyCap:           fields[2]?.value,
        reason:             fields[3]?.value,
      };
    }
    case 3: { // Custom
      return {
        type:             "Custom",
        actionType:       fields[0]?.value,
        description:      fields[1]?.value,
        payload:          fields[2]?.value,
        requestedAtEpoch: fields[3]?.value,
      };
    }
    default:
      return null;
  }
}

// ─── Update Pending Card ──────────────────────────────────────────────────────

export function updatePendingCard(pending) {
  const card = document.getElementById("pending-approval-card");
  const icon = document.getElementById("pending-icon");
  const text = document.getElementById("pending-text");

  if (!pending) {
    card.classList.remove("active");
    card.classList.add("disabled");
    icon.textContent = "🔒";
    text.textContent = "No Pending Approvals";
    return;
  }

  card.classList.remove("disabled");
  card.classList.add("active");
  icon.textContent = "⚡";

  switch (pending.type) {
    case "Transfer":
      text.textContent = `Pending Transfer: ${pending.amount} XRD → ${pending.to?.slice(0, 12)}...`;
      break;
    case "WhitelistAdd":
      text.textContent = `Pending Whitelist: ${pending.name} — ${pending.address?.slice(0, 12)}...`;
      break;
    case "UpdateLimits":
      text.textContent = `Pending Limits Update: max ${pending.maxPerTransaction} / daily ${pending.dailyCap}`;
      break;
    case "Custom":
      text.textContent = `Pending: ${pending.actionType} — ${pending.description?.slice(0, 40)}...`;
      break;
    default:
      text.textContent = "Pending Action";
  }
}

// ─── Check and Open Pending ───────────────────────────────────────────────────

export async function checkAndOpenPending() {
  const pending = await getPendingTransfer();
  if (!pending) return;

  openActionModal({
    title: "⚡ Pending Owner Approval",
    content: buildPendingContent(pending),
    hideConfirm: true,
    onConfirm: async () => {}
  });

  setTimeout(() => {
    document.getElementById("btn-approve")?.addEventListener("click", async () => {
      closeHow();
      await approvePending(pending);
    });
    document.getElementById("btn-reject")?.addEventListener("click", async () => {
      closeHow();
      await rejectPending();
    });
  }, 50);
}

// ─── Build modal content por tipo de acción ───────────────────────────────────

function buildPendingContent(pending) {
  let details = "";

  switch (pending.type) {
    case "Transfer":
      details = `
        <p style="font-size:14px;color:orange;margin:0;font-weight:600;">
          ${pending.amount} XRD → ${pending.to?.slice(0, 20)}...
        </p>
        <p style="font-size:12px;color:#555;margin:4px 0 0;">Reason: ${pending.reason}</p>
        <p style="font-size:12px;color:#555;margin:4px 0 0;">Requested at epoch: ${pending.requestedAtEpoch}</p>
      `;
      break;
    case "WhitelistAdd":
      details = `
        <p style="font-size:14px;color:#3498db;margin:0;font-weight:600;">
          Add to Whitelist: ${pending.name}
        </p>
        <p style="font-size:12px;color:#8b949e;margin:4px 0 0;font-family:monospace;">${pending.address}</p>
        <p style="font-size:12px;color:#555;margin:4px 0 0;">Reason: ${pending.reason}</p>
      `;
      break;
    case "UpdateLimits":
      details = `
        <p style="font-size:14px;color:#f39c12;margin:0;font-weight:600;">Update Spending Limits</p>
        <p style="font-size:12px;color:#8b949e;margin:4px 0 0;">Max per TX: ${pending.maxPerTransaction} XRD</p>
        <p style="font-size:12px;color:#8b949e;margin:4px 0 0;">Multisig threshold: ${pending.multisigThreshold} XRD</p>
        <p style="font-size:12px;color:#8b949e;margin:4px 0 0;">Daily cap: ${pending.dailyCap} XRD</p>
        <p style="font-size:12px;color:#555;margin:4px 0 0;">Reason: ${pending.reason}</p>
      `;
      break;
    case "Custom":
      details = `
        <p style="font-size:14px;color:#9b59b6;margin:0;font-weight:600;">${pending.actionType}</p>
        <p style="font-size:12px;color:#8b949e;margin:4px 0 0;">${pending.description}</p>
        <p style="font-size:11px;color:#555;margin:4px 0 0;font-family:monospace;word-break:break-all;">${pending.payload}</p>
      `;
      break;
  }

  return `
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
      <div style="background:#0a0f1a;border-radius:8px;padding:12px;border:1px solid rgba(255,165,0,0.3);">
        <p style="font-size:12px;color:#8b949e;margin:0 0 8px;">Your agent is requesting:</p>
        ${details}
      </div>
      <div style="display:flex;gap:12px;">
        <button id="btn-approve" style="flex:1;padding:12px;border-radius:8px;background:#27ae60;color:white;border:none;cursor:pointer;font-size:15px;font-weight:600;">
          ✅ Approve
        </button>
        <button id="btn-reject" style="flex:1;padding:12px;border-radius:8px;background:#c0392b;color:white;border:none;cursor:pointer;font-size:15px;font-weight:600;">
          ❌ Reject
        </button>
      </div>
    </div>
  `;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

async function approvePending(pending) {
  const account    = APP_STATE.activeAccount.address;
  const ownerBadge = APP_STATE.ownerBadgeAddress;
  const component  = APP_STATE.componentAddress;

  let manifest = `
CALL_METHOD
    Address("${account}")
    "create_proof_of_amount"
    Address("${ownerBadge}")
    Decimal("1")
;
CALL_METHOD
    Address("${component}")
    "approve_action"
;
`;

  // Solo Transfer devuelve fondos — hay que depositarlos
  if (pending.type === "Transfer") {
    manifest += `
TAKE_ALL_FROM_WORKTOP
    Address("${pending.asset}")
    Bucket("approved_bucket")
;
CALL_METHOD
    Address("${pending.to}")
    "try_deposit_or_abort"
    Bucket("approved_bucket")
    Enum<0u8>()
;
`;
  }

  console.log("APPROVE MANIFEST:\n", manifest);
  await sendTransaction(manifest);
  updatePendingCard(null);
}

// ─── Reject ───────────────────────────────────────────────────────────────────

async function rejectPending() {
  const account    = APP_STATE.activeAccount.address;
  const ownerBadge = APP_STATE.ownerBadgeAddress;
  const component  = APP_STATE.componentAddress;

  const manifest = `
CALL_METHOD
    Address("${account}")
    "create_proof_of_amount"
    Address("${ownerBadge}")
    Decimal("1")
;
CALL_METHOD
    Address("${component}")
    "reject_action"
;
`;

  await sendTransaction(manifest);
  updatePendingCard(null);
}
