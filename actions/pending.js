import { CONFIG } from "../config.js";
import { APP_STATE } from "../utils/state.js";
import { openActionModal, closeHow } from "../utils/modal.js";
import { sendTransaction } from "./radix.js";

export async function getPendingTransfer() {
  if (!APP_STATE.componentAddress || !APP_STATE.ownerBadgeAddress) return null;

  const manifest = `
CALL_METHOD Address("${APP_STATE.activeAccount.address}") "create_proof_of_amount" Address("${APP_STATE.ownerBadgeAddress}") Decimal("1") ;
CALL_METHOD Address("${APP_STATE.componentAddress}") "get_pending_transfer" ;
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

  if (!output || output.variant_id === "0") return null;

  const fields = output?.fields?.[0]?.fields;
  return {
    to:               fields?.[0]?.value,
    amount:           fields?.[1]?.value,
    asset:            fields?.[2]?.value,
    reason:           fields?.[3]?.value,
    requestedAtEpoch: fields?.[4]?.value,
  };
}

export function updatePendingCard(pending) {
  const card = document.getElementById("pending-approval-card");
  const icon = document.getElementById("pending-icon");
  const text = document.getElementById("pending-text");

  if (!pending) {
    card.classList.remove("active");
    card.classList.add("disabled");
    icon.textContent = "🔒";
    text.textContent = "No Pending Approvals";
  } else {
    card.classList.remove("disabled");
    card.classList.add("active");
    icon.textContent = "⚡";
    text.textContent = `Pending: ${pending.amount} XRD → ${pending.to.slice(0, 12)}...`;
  }
}

export async function checkAndOpenPending() {
  const pending = await getPendingTransfer();
  if (!pending) return;

  openActionModal({
    title: "⚡ Pending Owner Approval",
    content: `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
        <div style="background:#0a0f1a;border-radius:8px;padding:12px;border:1px solid rgba(255,165,0,0.3);">
          <p style="font-size:12px;color:#8b949e;margin:0 0 4px;">Your agent is requesting a large transfer:</p>
          <p style="font-size:14px;color:orange;margin:0;font-weight:600;">${pending.amount} → ${pending.to.slice(0, 20)}...</p>
          <p style="font-size:12px;color:#555;margin:4px 0 0;">Reason: ${pending.reason}</p>
          <p style="font-size:12px;color:#555;margin:4px 0 0;">Requested at epoch: ${pending.requestedAtEpoch}</p>
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
    `,
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

async function approvePending(pending) {
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
    "approve_transfer"
;
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
  console.log("APPROVE MANIFEST:\n", manifest);

  await sendTransaction(manifest);
  updatePendingCard(null);
}

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
    "reject_transfer"
;
`;

  await sendTransaction(manifest);
  updatePendingCard(null);
}
