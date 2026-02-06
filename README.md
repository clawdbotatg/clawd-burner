# 🔥 CLAWD Burner

Deflationary burn engine for $CLAWD on Base. Burns 500K CLAWD per hour — anyone can trigger the burn and earn a 5K CLAWD reward.

![CLAWD Burner](packages/nextjs/public/thumbnail.png)

## 🔗 Links

- **Live App:** [burner.clawdbotatg.eth.limo](https://burner.clawdbotatg.eth.limo) *(pending ENS setup)*
- **IPFS:** [community.bgipfs.com/ipfs/bafybeiapxjiqph4nge4dgasu37jhmxvjaae7b2v74g2ui6tdf25h4wjvou](https://community.bgipfs.com/ipfs/bafybeiapxjiqph4nge4dgasu37jhmxvjaae7b2v74g2ui6tdf25h4wjvou)
- **Contract:** [0xe499B193ffD38626D79e526356F3445ce0A943B9](https://basescan.org/address/0xe499B193ffD38626D79e526356F3445ce0A943B9) (Base)
- **$CLAWD Token:** [0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07](https://basescan.org/token/0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07) (Base)

## How It Works

1. **Tokens Accumulate** — 500K $CLAWD becomes burnable every hour (configurable)
2. **Anyone Burns** — Call `burn()` to send accumulated tokens to the dead address (0x...dEaD)
3. **Earn Rewards** — Caller gets 5K CLAWD for triggering each burn

The contract is self-sustaining: bots and users are incentivized to trigger burns for the reward. No admin action needed once funded.

## Features

- **Scheduled burns**: 500K CLAWD/hour burn rate
- **Caller incentive**: 5K CLAWD reward per burn call
- **Admin controls**: Toggle on/off, adjust burn rate and reward
- **Emergency withdraw**: Owner can pull tokens if needed
- **USD values**: Live price from DexScreener
- **Burn history**: Event log of all burns with caller addresses

## Smart Contract

`CLAWDBurner.sol` — Ownable, ReentrancyGuard, SafeERC20

| Function | Access | Description |
|----------|--------|-------------|
| `burn()` | Anyone | Trigger scheduled burn, earn reward |
| `pendingBurn()` | View | How much would burn if called now |
| `toggle()` | Owner | Pause/unpause burns |
| `setBurnRate(uint256)` | Owner | Change hourly burn rate |
| `setCallerReward(uint256)` | Owner | Change caller reward |
| `withdraw(uint256)` | Owner | Emergency token withdrawal |

## Developer Quickstart

```bash
git clone https://github.com/clawdbotatg/clawd-burner.git
cd clawd-burner
yarn install

# Start local fork of Base
yarn fork --network base

# Deploy contracts
yarn deploy

# Start frontend
yarn start
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
packages/
├── foundry/
│   ├── contracts/CLAWDBurner.sol    # Main contract
│   ├── script/DeployClawdBurner.s.sol
│   └── test/CLAWDBurner.t.sol       # 19 tests including fuzz
└── nextjs/
    ├── app/page.tsx                  # Main UI
    ├── contracts/
    │   ├── deployedContracts.ts      # Auto-generated ABIs
    │   └── externalContracts.ts      # CLAWD token ABI
    └── scaffold.config.ts            # Base + Alchemy RPC
```

## Stack

- [Scaffold-ETH 2](https://scaffoldeth.io) — Ethereum dev framework
- [Foundry](https://getfoundry.sh) — Smart contract toolchain
- [Next.js](https://nextjs.org) — React framework
- [Base](https://base.org) — L2 chain
- IPFS via [BuidlGuidl IPFS](https://bgipfs.com)

## Tests

```bash
cd packages/foundry
forge test -vv
# 19 tests pass, including fuzz tests
```

---

Built by [Clawd](https://clawdbotatg.eth.limo) 🤖 with ❤️ at [BuidlGuidl](https://buidlguidl.com)
