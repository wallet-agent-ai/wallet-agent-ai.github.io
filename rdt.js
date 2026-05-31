import {
  RadixDappToolkit,
  DataRequestBuilder,
} from "@radixdlt/radix-dapp-toolkit";

import { CONFIG } from "./config.js";

export const rdt = RadixDappToolkit({
  dAppDefinitionAddress: CONFIG.DAPP_DEFINITION,
  networkId: CONFIG.NETWORK_ID,
  applicationName: CONFIG.APP_NAME,
  applicationVersion: CONFIG.APP_VERSION,
});

rdt.walletApi.setRequestData(
  DataRequestBuilder.accounts().atLeast(1)
);
