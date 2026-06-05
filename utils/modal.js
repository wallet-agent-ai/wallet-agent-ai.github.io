// utils/modal.js

// ── Carga contenido desde /content/*.html y abre el howModal ──
async function loadModal(title, file) {
  const res = await fetch(`/content/${file}`);
  const html = await res.text();
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalContent").innerHTML = html;
  document.getElementById("howModal").classList.add("active");
}

export function openLimitsModal() {
  openActionModal({
    title: "Limits & Daily Cap",
    hideConfirm: true,
    content: `
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px;">
        <button id="btn-increase-limits" style="padding:12px;border-radius:8px;background:#276ff5;color:white;border:none;cursor:pointer;font-size:15px;font-weight:600;">
          📈 Increase Limits
        </button>
        <button id="btn-reset-daily" style="padding:12px;border-radius:8px;background:#7c4dff;color:white;border:none;cursor:pointer;font-size:15px;font-weight:600;">
          🔄 Reset Daily Cap
        </button>
      </div>
    `,
  });

  setTimeout(() => {
    document.getElementById("btn-increase-limits")?.addEventListener("click", () => {
      closeHow();
      increaseLimits();
    });
    document.getElementById("btn-reset-daily")?.addEventListener("click", () => {
      closeHow();
      resetDailyCap();
    });
  }, 50);
}


export function showLoadingModal(title, message) {
  document.getElementById("modalTitle").innerText = title;
  document.getElementById("modalContent").innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px 0;">
      <div style="font-size:40px;">⏳</div>
      <p style="color:#8b949e;font-size:14px;text-align:center;margin:0;">${message}</p>
    </div>
  `;
  const closeBtn = document.querySelector("#howModal button[onclick='closeHow()']");
  if (closeBtn) closeBtn.style.display = "none";
  document.getElementById("howModal").classList.add("active");
}

export function restoreModal() {
  const closeBtn = document.querySelector("#howModal button[onclick='closeHow()']");
  if (closeBtn) closeBtn.style.display = "";
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


// modal para deposit
export async function deposit() {
  if (!APP_STATE.activeAccount || !APP_STATE.ownerBadgeAddress || !APP_STATE.componentAddress) {
    console.error("Missing APP_STATE data for deposit");
    return;
  }

  const tokens = await getAccountTokens();

  const options = tokens.map(t => `
    <option value="${t.address}">
      ${t.symbol} — ${t.name} (${parseFloat(t.amount).toFixed(2)} available)
    </option>
  `).join("");

  openActionModal({
    title: "Deposit to Agent Wallet",
    content: `
      <label>Select Token</label>
      <select id="deposit-resource" style="width:100%;padding:8px;margin:8px 0 16px;border-radius:8px;background:#111;color:white;border:1px solid #333;">
        ${options}
      </select>
      <label>Amount</label>
      <input id="deposit-amount" type="number"
        placeholder="0.0" min="0" step="0.1"
        style="width:100%;padding:8px;border-radius:8px;background:#111;color:white;border:1px solid #333;"
      />
    `,
    confirmText: "Deposit",
    onConfirm: async () => {
      const resourceAddress = document.getElementById("deposit-resource").value.trim();
      const amount          = document.getElementById("deposit-amount").value.trim();

      if (!resourceAddress || !amount || parseFloat(amount) <= 0) {
        console.error("Invalid deposit inputs");
        return;
      }

      const manifest = depositManifest(resourceAddress, amount);
      console.log("DEPOSIT MANIFEST:", manifest);
      await sendTransaction(manifest);
    }
  });
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

