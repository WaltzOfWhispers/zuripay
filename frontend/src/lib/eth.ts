import { BrowserProvider, ethers } from "ethers";

function getProvider(): BrowserProvider {
  const { ethereum } = window as any;
  if (!ethereum) {
    throw new Error("No injected wallet found. Please open with MetaMask.");
  }
  return new BrowserProvider(ethereum);
}

export async function resolveRecipient(recipient: string): Promise<string> {
  // If already looks like address, return it
  if (ethers.isAddress(recipient)) {
    return ethers.getAddress(recipient);
  }

  const provider = getProvider();
  const resolved = await provider.resolveName(recipient);
  if (!resolved) {
    throw new Error("Could not resolve ENS name");
  }
  return resolved;
}

export interface SendEthParams {
  to: string;
  amountEth: string;
}

export async function sendEth({ to, amountEth }: SendEthParams): Promise<string> {
  const provider = getProvider();
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
