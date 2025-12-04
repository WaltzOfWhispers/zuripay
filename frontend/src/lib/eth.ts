import { BrowserProvider, ethers } from "ethers";

function getProvider(externalProvider?: any): BrowserProvider {
  const provider = externalProvider ?? (window as any).ethereum;
  if (!provider) {
    throw new Error("No wallet provider found. Connect a wallet first.");
  }
  return new BrowserProvider(provider);
}

export async function resolveRecipient(
  recipient: string,
  externalProvider?: any
): Promise<string> {
  // If already looks like address, return it
  if (ethers.isAddress(recipient)) {
    return ethers.getAddress(recipient);
  }

  const provider = getProvider(externalProvider);
  const resolved = await provider.resolveName(recipient);
  if (!resolved) {
    throw new Error("Could not resolve ENS name");
  }
  return resolved;
}

export interface SendEthParams {
  to: string;
  amountEth: string;
  externalProvider?: any;
}

export async function sendEth({ to, amountEth }: SendEthParams): Promise<string> {
  const provider = getProvider(arguments[0]?.externalProvider);
  const signer = await provider.getSigner();
  const tx = await signer.sendTransaction({
    to,
    value: ethers.parseEther(amountEth),
  });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getConnectedAddress(): Promise<string> {
  const provider = getProvider();
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return signer.getAddress();
}
