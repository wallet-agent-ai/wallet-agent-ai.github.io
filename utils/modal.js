// utils/modal.js

// ── Carga contenido desde /content/*.html y abre el howModal ──
async function loadModal(title, file) {
  const res = await fetch(`/content/${file}`);
  const html = await res.text();
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("howModal").classList.add("active");
}

// ── Abre con contenido externo ──
export function openHow()        { loadModal("How it Works",       "how.html"); }
export function openTerms()      { loadModal("Terms & Conditions", "terms.html"); }
export function openPrivacy()    { loadModal("Privacy Policy",     "privacy.html"); }
export function openAbout()      { loadModal("About",              "about.html"); }

// ── Disclaimer: abre el modal dedicado #disclaimer ──
export function openDisclaimer() { 
  loadModal("Disclaimer", "disclaimer.html"); 
}
// Y en inicial 
export function openInitialDisclaimer() {
  document.getElementById("disclaimer").classList.add("active");
}

// ── Cierra modales ──
export function closeHow() {
  document.getElementById("howModal").classList.remove("active");
}

export function closeDisclaimer() {
  document.getElementById("disclaimer").classList.remove("active");
}

// ── Modal de acción con botón confirm (usado por otras partes del app) ──
export function openActionModal({ title, content, confirmText = "Confirm", onConfirm, hideConfirm = false }) {
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalContent").innerHTML = `
    ${content}
    ${!hideConfirm ? `
    <div class="modal-actions">
      <button id="confirmActionBtn">${confirmText}</button>
    </div>` : ""}
  `;
  document.getElementById("howModal").classList.add("active");

  if (!hideConfirm) {
    document.getElementById("confirmActionBtn").onclick = async () => {
      try {
        closeHow();
        await onConfirm();
      } catch (err) {
        console.error(err);
      }
    };
  }
}

// ── Emergency Modal — nivel 1: elige acción ──
export function openEmergencyModal() {
  document.getElementById("modalTitle").innerText = "🔴 Emergency Controls";
  document.getElementById("modalContent").innerHTML = `
    <p style="color:#8b949e;font-size:14px;margin:0 0 20px;">
      Select an emergency action. Each action will require your signature in Radix Wallet.
    </p>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <button onclick="closeHow(); freeze();"
        style="padding:14px;border-radius:10px;background:#1a1a2e;border:1px solid #444;
               color:white;font-size:15px;cursor:pointer;text-align:left;">
        🧊 <strong>Freeze Agent</strong>
        <span style="display:block;font-size:12px;color:#8b949e;margin-top:4px;">
          Lock all outgoing activity of the agent wallet.
        </span>
      </button>
      <button onclick="closeHow(); unfreeze();"
        style="padding:14px;border-radius:10px;background:#1a1a2e;border:1px solid #444;
               color:white;font-size:15px;cursor:pointer;text-align:left;">
        🔓 <strong>Unfreeze Agent</strong>
        <span style="display:block;font-size:12px;color:#8b949e;margin-top:4px;">
          Restore all outgoing activity of the agent wallet.
        </span>
      </button>
      <button onclick="closeHow(); emergencyWithdraw();"
        style="padding:14px;border-radius:10px;background:#2d0000;border:1px solid #c0392b;
               color:#ff6b6b;font-size:15px;cursor:pointer;text-align:left;">
        💸 <strong>Emergency Withdraw</strong>
        <span style="display:block;font-size:12px;color:#8b949e;margin-top:4px;">
          Recover ALL funds from the contract directly to your wallet.
        </span>
      </button>
    </div>
  `;
  document.getElementById("howModal").classList.add("active");
}

