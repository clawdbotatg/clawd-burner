"use client";

import { useState, useEffect } from "react";
import { Address } from "~~/components/scaffold-eth";
import type { NextPage } from "next";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract, useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const CLAWD_TOKEN = "0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07";

const formatClawd = (value: bigint | undefined): string => {
  if (!value) return "0";
  const num = parseFloat(formatUnits(value, 18));
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
};

const formatClawdFull = (value: bigint | undefined): string => {
  if (!value) return "0";
  return parseFloat(formatUnits(value, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatTime = (seconds: number): string => {
  if (seconds <= 0) return "now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const [isBurning, setIsBurning] = useState(false);
  const [clawdPrice, setClawdPrice] = useState<number>(0);
  const [timeSince, setTimeSince] = useState<number>(0);

  // Read contract state
  const { data: isActive } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "active" });
  const { data: totalBurned } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "totalBurned" });
  const { data: burnRatePerHour } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "burnRatePerHour" });
  const { data: callerReward } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "callerReward" });
  const { data: pendingBurnAmount } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "pendingBurn" });
  const { data: balance } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "contractBalance" });
  const { data: lastBurnTime } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "lastBurnTime" });
  const { data: owner } = useScaffoldReadContract({ contractName: "ClawdBurner", functionName: "owner" });

  const { writeContractAsync: writeBurner } = useScaffoldWriteContract("ClawdBurner");

  // Burn events
  const { data: burnEvents } = useScaffoldEventHistory({
    contractName: "ClawdBurner",
    eventName: "Burned",
    fromBlock: 0n,
    watch: true,
  });

  // Fetch CLAWD price
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

  // Time since last burn counter
  useEffect(() => {
    if (!lastBurnTime) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setTimeSince(now - Number(lastBurnTime));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastBurnTime]);

  const hasPendingBurn = pendingBurnAmount !== undefined && pendingBurnAmount > 0n;

  const toUsd = (value: bigint | undefined): string => {
    if (!value || clawdPrice === 0) return "";
    const usd = parseFloat(formatUnits(value, 18)) * clawdPrice;
    if (usd < 0.01) return "< $0.01";
    return `~$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  // Estimated hours of fuel remaining
  const hoursRemaining = (): string => {
    if (!balance || !burnRatePerHour || burnRatePerHour === 0n) return "∞";
    const hours = Number(balance) / Number(burnRatePerHour);
    if (hours > 8760) return `${(hours / 8760).toFixed(1)} years`;
    if (hours > 720) return `${(hours / 720).toFixed(1)} months`;
    if (hours > 24) return `${(hours / 24).toFixed(1)} days`;
    return `${hours.toFixed(1)} hours`;
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

  return (
    <div className="flex flex-col items-center grow pt-6 px-4 pb-12">
      <div className="w-full max-w-4xl">

        {/* Hero — Total Burned */}
        <div className="text-center mb-8">
          <p className="text-lg opacity-70 mb-1">Total $CLAWD Burned Forever</p>
          <p className="text-5xl font-bold text-orange-500">
            🔥 {formatClawd(totalBurned)}
          </p>
          {totalBurned && clawdPrice > 0 && (
            <p className="text-sm opacity-50 mt-1">{toUsd(totalBurned)} worth of CLAWD</p>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Burn Rate</p>
            <p className="text-xl font-bold">{formatClawd(burnRatePerHour)}/hr</p>
            {burnRatePerHour && clawdPrice > 0 && (
              <p className="text-xs opacity-50">{toUsd(burnRatePerHour)}/hr</p>
            )}
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Caller Reward</p>
            <p className="text-xl font-bold">{formatClawd(callerReward)}</p>
            {callerReward && clawdPrice > 0 && (
              <p className="text-xs opacity-50">{toUsd(callerReward)}</p>
            )}
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Fuel Remaining</p>
            <p className="text-xl font-bold">{formatClawd(balance)}</p>
            <p className="text-xs opacity-50">{hoursRemaining()}</p>
          </div>
          <div className="bg-base-200 rounded-2xl p-4 text-center">
            <p className="text-xs opacity-60 uppercase tracking-wider">Time Since Burn</p>
            <p className="text-xl font-bold font-mono">{formatTime(timeSince)}</p>
            <p className="text-xs opacity-50">accumulating...</p>
          </div>
        </div>

        {/* Burn Action */}
        <div className="bg-base-200 rounded-2xl p-6 mb-8">
          <div className="flex flex-col items-center gap-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
              <span className="font-medium">{isActive ? "Burns Active" : "Burns Paused"}</span>
            </div>

            {/* Pending burn */}
            {isActive && (
              <div className="text-center">
                <p className="text-sm opacity-60">Pending Burn</p>
                <p className="text-3xl font-bold text-orange-400">
                  {formatClawdFull(pendingBurnAmount)} CLAWD
                </p>
                {pendingBurnAmount && clawdPrice > 0 && (
                  <p className="text-sm opacity-50">{toUsd(pendingBurnAmount)}</p>
                )}
              </div>
            )}

            {/* Button */}
            <div className="w-full max-w-sm">
              {!connectedAddress ? (
                <p className="text-center text-sm opacity-60">Connect wallet to burn</p>
              ) : (
                <button
                  className="btn btn-warning w-full text-lg"
                  disabled={isBurning || !hasPendingBurn || !isActive}
                  onClick={handleBurn}
                >
                  {isBurning ? (
                    <><span className="loading loading-spinner loading-sm" /> Burning...</>
                  ) : !isActive ? (
                    "Burns Paused"
                  ) : !hasPendingBurn ? (
                    "No Tokens to Burn Yet"
                  ) : (
                    `🔥 Burn ${formatClawd(pendingBurnAmount)} — Earn ${formatClawd(callerReward)}`
                  )}
                </button>
              )}
            </div>

            {callerReward && connectedAddress && (
              <p className="text-xs opacity-50">
                You earn {formatClawd(callerReward)} CLAWD for each burn call
                {clawdPrice > 0 && ` (${toUsd(callerReward)})`}
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
              <p className="text-sm opacity-60">
                {formatClawd(burnRatePerHour)} CLAWD becomes burnable every hour
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">🔥</div>
              <p className="font-medium">Anyone Burns</p>
              <p className="text-sm opacity-60">
                Click burn to send tokens to the dead address — permanently removed
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <p className="font-medium">Earn Rewards</p>
              <p className="text-sm opacity-60">
                Caller gets {formatClawd(callerReward)} CLAWD for triggering each burn
              </p>
            </div>
          </div>
        </div>

        {/* Admin info */}
        {owner && (
          <div className="text-center text-xs opacity-40 mb-4">
            Owner: <Address address={owner} />
          </div>
        )}

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
                          {formatClawd(event.args.reward)}
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
