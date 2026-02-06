"use client";

import { useState, useEffect } from "react";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { base } from "viem/chains";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const CLAWD_TOKEN = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07";
const CLAWD_TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n; // 1 billion tokens

const formatClawd = (value: bigint | undefined): string => {
  if (!value) return "0";
  const formatted = formatUnits(value, 18);
  const num = parseFloat(formatted);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
};

const formatClawdFull = (value: bigint | undefined): string => {
  if (!value) return "0";
  return parseFloat(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [clawdPrice, setClawdPrice] = useState<number>(0);

  // Read contract state
  const { data: totalBurned } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "totalBurned" });
  const { data: burnRatePerHour } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "burnRatePerHour" });
  const { data: callerReward } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "callerReward" });
  const { data: burnsEnabled } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "burnsEnabled" });
  const { data: pendingBurn } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "pendingBurnAmount" });
  const { data: contractBalance } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "contractBalance" });
  const { data: lastBurnTimestamp } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "lastBurnTimestamp" });
  const { data: totalBurnCalls } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "totalBurnCalls" });

  const { writeContractAsync: writeBurner } = useScaffoldWriteContract("ClawdBurner");

  // Fetch burn events
  const { data: burnEvents } = useScaffoldEventHistory({
    contractName: "ClawdBurner",
    eventName: "BurnExecuted",
    fromBlock: 0n,
    watch: true,
  });

  // Fetch CLAWD price from DexScreener
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CLAWD_TOKEN}`);
        const data = await res.json();
        if (data.pairs && data.pairs.length > 0) {
          setClawdPrice(parseFloat(data.pairs[0].priceUsd || "0"));
        }
      } catch (e) {
        console.error("Failed to fetch CLAWD price:", e);
      }
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!lastBurnTimestamp || !burnRatePerHour || !burnsEnabled) return;

    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - Number(lastBurnTimestamp);
      // Minimum time for at least 1 token of burn accumulation
      const minTime = Math.max(1, Math.floor(3600 / Number(formatUnits(burnRatePerHour, 18))));
      const remaining = Math.max(0, minTime - elapsed);
      setCountdown(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastBurnTimestamp, burnRatePerHour, burnsEnabled]);

  const wrongNetwork = chainId !== base.id;
  const hasPendingBurn = pendingBurn !== undefined && pendingBurn > 0n;

  const clawdToSupplyPercent = (value: bigint | undefined): string => {
    if (!value) return "";
    const percent = (Number(value) / Number(CLAWD_TOTAL_SUPPLY)) * 100;
    if (percent < 0.001) return "(< 0.001% of supply)";
    if (percent < 0.01) return `(${percent.toFixed(4)}% of supply)`;
    if (percent < 1) return `(${percent.toFixed(3)}% of supply)`;
    return `(${percent.toFixed(2)}% of supply)`;
  };

  const handleBurn = async () => {
    setIsBurning(true);
    try {
      await writeBurner({ functionName: "burn" });
    } catch (e) {
      console.error("Burn failed:", e);
    } finally {
      setIsBurning(false);
    }
  };

  const handleSwitchNetwork = async () => {
    setIsSwitching(true);
    try {
      switchChain({ chainId: base.id });
    } catch (e) {
      console.error("Switch failed:", e);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex flex-col items-center grow pt-6 px-4 pb-12">
      {/* Hero Stats */}
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <p className="text-lg opacity-70 mb-1">Total $CLAWD Burned Forever</p>
          <p className="text-5xl font-bold text-orange-500">
            🔥 {formatClawd(totalBurned)}
          </p>
          {totalBurned && clawdPrice > 0 && (
            <p className="text-sm opacity-50 mt-1">
              {clawdToSupplyPercent(totalBurned)}
            </p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Burn Rate</p>
            <p className="text-xl font-bold">{formatClawd(burnRatePerHour)}/hr</p>
            {burnRatePerHour && clawdPrice > 0 && (
              <p className="text-xs opacity-50">{clawdToSupplyPercent(burnRatePerHour)}</p>
            )}
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Caller Reward</p>
            <p className="text-xl font-bold">{formatClawd(callerReward)}</p>
            {callerReward && clawdPrice > 0 && (
              <p className="text-xs opacity-50">{clawdToSupplyPercent(callerReward)}</p>
            )}
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Contract Balance</p>
            <p className="text-xl font-bold">{formatClawd(contractBalance)}</p>
            {contractBalance && clawdPrice > 0 && (
              <p className="text-xs opacity-50">{clawdToSupplyPercent(contractBalance)}</p>
            )}
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Total Burns</p>
            <p className="text-xl font-bold">{totalBurnCalls?.toString() || "0"}</p>
          </div>
        </div>

        {/* Status & Burn Action */}
        <div className="bg-base-200 rounded-2xl p-6 mb-8">
          <div className="flex flex-col items-center gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${burnsEnabled ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className="font-medium">{burnsEnabled ? "Burns Active" : "Burns Paused"}</span>
            </div>

            {/* Pending burn info */}
            {burnsEnabled && (
              <div className="text-center">
                <p className="text-sm opacity-60">Pending Burn Amount</p>
                <p className="text-2xl font-bold text-orange-400">
                  {formatClawdFull(pendingBurn)} CLAWD
                </p>
                {pendingBurn && clawdPrice > 0 && (
                  <p className="text-xs opacity-50">{clawdToSupplyPercent(pendingBurn)}</p>
                )}
                {countdown > 0 && !hasPendingBurn && (
                  <p className="text-sm opacity-60 mt-2">
                    Next burn eligible in <span className="font-mono font-bold">{countdown}s</span>
                  </p>
                )}
              </div>
            )}

            {/* Action button */}
            <div className="w-full max-w-sm">
              {!connectedAddress ? (
                <p className="text-center text-sm opacity-60">Connect wallet to burn</p>
              ) : wrongNetwork ? (
                <button
                  className="btn btn-primary w-full"
                  disabled={isSwitching}
                  onClick={handleSwitchNetwork}
                >
                  {isSwitching ? (
                    <><span className="loading loading-spinner loading-sm"></span> Switching...</>
                  ) : (
                    "Switch to Base"
                  )}
                </button>
              ) : (
                <button
                  className="btn btn-warning w-full text-lg"
                  disabled={isBurning || !hasPendingBurn || !burnsEnabled}
                  onClick={handleBurn}
                >
                  {isBurning ? (
                    <><span className="loading loading-spinner loading-sm"></span> Burning...</>
                  ) : !burnsEnabled ? (
                    "Burns Paused"
                  ) : !hasPendingBurn ? (
                    "No Tokens to Burn Yet"
                  ) : (
                    `🔥 Burn ${formatClawd(pendingBurn)} CLAWD — Earn ${formatClawd(callerReward)} Reward`
                  )}
                </button>
              )}
            </div>

            {callerReward && clawdPrice > 0 && connectedAddress && !wrongNetwork && (
              <p className="text-xs opacity-50">
                You earn {formatClawd(callerReward)} CLAWD {clawdToSupplyPercent(callerReward)} for each burn call
              </p>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-base-200 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl mb-2">⏰</div>
              <p className="font-medium">Tokens Accumulate</p>
              <p className="text-sm opacity-60">500K CLAWD becomes burnable every hour</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔥</div>
              <p className="font-medium">Anyone Burns</p>
              <p className="text-sm opacity-60">Click the burn button to send tokens to the dead address</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <p className="font-medium">Earn Rewards</p>
              <p className="text-sm opacity-60">Caller gets 5K CLAWD as incentive for triggering the burn</p>
            </div>
          </div>
        </div>

        {/* Burn History */}
        {burnEvents && burnEvents.length > 0 && (
          <div className="bg-base-200 rounded-2xl p-6">
            <h2 className="text-lg font-bold mb-4">Recent Burns</h2>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Caller</th>
                    <th className="text-right">Burned</th>
                    <th className="text-right">Reward</th>
                    <th className="text-right">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {burnEvents
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((event, i) => (
                      <tr key={i}>
                        <td>
                          <Address address={event.args.caller} />
                        </td>
                        <td className="text-right text-orange-400">
                          {formatClawd(event.args.burnAmount)} 🔥
                        </td>
                        <td className="text-right">
                          {formatClawd(event.args.callerReward)}
                        </td>
                        <td className="text-right font-mono text-xs opacity-60">
                          {event.blockNumber?.toString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
