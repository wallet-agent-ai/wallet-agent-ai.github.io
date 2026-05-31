import { CONFIG } from "../config.js";
import { APP_STATE } from "./state.js";

function getMeta(metadata, key) {
  const entry = metadata.find(m => m.key === key);
  return entry?.value?.typed?.value || null;
}

function getMetaArray(metadata, key) {
  const entry = metadata.find(m => m.key === key);
  return entry?.value?.typed?.values || [];
}

async function getComponentState(componentAddress) {
  const response = await fetch(`${CONFIG.GATEWAY_URL}/state/entity/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [componentAddress],
      aggregation_level: "Global"
    }),
  });
  const data = await response.json();
  const fields = data?.items?.[0]?.details?.state?.fields || [];
  const notarizerField = fields.find(f => f.field_name === "notarizer_account");
  return notarizerField?.value || null;
}

async function getAgentBadgeFromNotarizer(notarizerAccount) {
  const response = await fetch(`${CONFIG.GATEWAY_URL}/state/entity/details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      addresses: [notarizerAccount],
      aggregation_level: "Vault",
      opt_ins: {
        explicit_metadata: ["name", "symbol", "dapp_definitions"]
      }
    }),
  });
  const data = await response.json();
  const nfResources = data?.items?.[0]?.non_fungible_resources?.items || [];

  for (const resource of nfResources) {
    const metadata = resource.explicit_metadata?.items || [];
    const name   = getMeta(metadata, "name");
    const symbol = getMeta(metadata, "symbol");
    const dapps  = getMetaArray(metadata, "dapp_definitions");

    if (
      name   === CONFIG.AGENT_BADGE_NAME &&
      symbol === CONFIG.AGENT_BADGE_SYMBOL &&
      dapps.includes(CONFIG.DAPP_DEFINITION)
    ) {
      const vaultItem = resource.vaults?.items?.[0];
      return {
        resourceAddress: resource.resource_address,
        vaultAddress: vaultItem?.vault_address || null,
        localId: "#1#"
      };
    }
  }
  return null;
}

async function applyPVOB(resource, component) {
  APP_STATE.ownerBadgeAddress = resource.resource_address;
  APP_STATE.componentAddress = component;

  const notarizerAccount = await getComponentState(component);
  if (!notarizerAccount) return;

  APP_STATE.notarizerAccount = notarizerAccount;
  const badge = await getAgentBadgeFromNotarizer(notarizerAccount);
  if (!badge) return;

  APP_STATE.agentBadgeAddress = badge.resourceAddress;
  APP_STATE.agentBadgeVaultAddress = badge.vaultAddress;
  APP_STATE.agentBadgeLocalId = badge.localId;
}

function isOwnerBadge(resource, { requireAmount }) {
  const metadata = resource.explicit_metadata?.items || [];
  const name = getMeta(metadata, "name");
  const symbol = getMeta(metadata, "symbol");
  const dapps = getMetaArray(metadata, "dapp_definitions");
  const component = getMeta(metadata, "component");

  if (
    name !== CONFIG.OWNER_BADGE_NAME ||
    symbol !== CONFIG.OWNER_BADGE_SYMBOL ||
    !dapps.includes(CONFIG.DAPP_DEFINITION) ||
    !component
  ) {
    return null;
  }

  if (requireAmount) {
    const amount = resource.vaults?.items?.[0]?.amount || "0";
    if (parseFloat(amount) !== 1) return null;
  } else if (!resource.vaults?.items?.length) {
    return null;
  }

  return component;
}

export async function accountHasAgent(accountAddress) {
  try {
    const response = await fetch(`${CONFIG.GATEWAY_URL}/state/entity/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [accountAddress],
        aggregation_level: "Vault",
        opt_ins: {
          non_fungible_include_nfids: true,
          explicit_metadata: ["name", "symbol", "dapp_definitions", "component"]
        }
      }),
    });

    const data = await response.json();
    const item = data?.items?.[0];
    const fungibles = item?.fungible_resources?.items || [];
    const nonFungibles = item?.non_fungible_resources?.items || [];

    for (const resource of fungibles) {
      const component = isOwnerBadge(resource, { requireAmount: true });
      if (component) {
        await applyPVOB(resource, component);
        return true;
      }
    }

    for (const resource of nonFungibles) {
      const component = isOwnerBadge(resource, { requireAmount: false });
      if (component) {
        await applyPVOB(resource, component);
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("NFT DETECTION ERROR:", err);
    return false;
  }
}
