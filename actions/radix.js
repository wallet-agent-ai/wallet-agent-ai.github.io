// actions/radix.js
import { rdt } from "../rdt.js";
import { updateAccountState } from "../utils/accountSelector.js";
import { APP_STATE } from "../utils/state.js";

export async function sendTransaction(manifest) {
  try {
    console.log("Sending TX...", manifest);

    const result = await rdt.walletApi.sendTransaction({
      transactionManifest: manifest,
      version: 1,
    });

    if (result.isErr()) {
      console.error("TX ERROR:", result.error);
      return null;
    }

    console.log("TX SUCCESS:", result.value);
    if (APP_STATE.activeAccount) {
        await updateAccountState(APP_STATE.activeAccount);
    }
    return result.value;

  } catch (err) {
    console.error("sendTransaction failed:", err);
    return null;
  }
}
