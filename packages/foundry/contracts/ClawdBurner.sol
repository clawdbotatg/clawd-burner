// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CLAWDBurner
 * @notice Scheduled $CLAWD token burner with caller incentives.
 *         Burns 500k CLAWD per hour. Anyone can call burn() to trigger it
 *         and earn 5k CLAWD as a reward. Admin can toggle burns on/off
 *         and adjust rates.
 *
 *         "Burn" = transfer to 0x000...dEaD (permanent removal from circulation).
 */
contract CLAWDBurner is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutables ──────────────────────────────────────────────
    IERC20 public immutable clawd;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ── State ───────────────────────────────────────────────────
    bool public active;
    uint256 public burnRatePerHour;   // tokens (18 dec) to burn per hour
    uint256 public callerReward;      // tokens (18 dec) paid to burn() caller
    uint256 public lastBurnTime;      // timestamp of last burn
    uint256 public totalBurned;       // lifetime tokens sent to DEAD

    // ── Events ──────────────────────────────────────────────────
    event Burned(address indexed caller, uint256 burnAmount, uint256 reward, uint256 elapsed);
    event Toggled(bool active);
    event BurnRateUpdated(uint256 newRate);
    event CallerRewardUpdated(uint256 newReward);
    event Funded(address indexed funder, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ── Constructor ─────────────────────────────────────────────
    constructor(
        address _clawd,
        uint256 _burnRatePerHour,
        uint256 _callerReward,
        address _owner
    ) Ownable(_owner) {
        clawd = IERC20(_clawd);
        burnRatePerHour = _burnRatePerHour;
        callerReward = _callerReward;
        lastBurnTime = block.timestamp;
        active = true;
    }

    // ── Public: Burn ────────────────────────────────────────────
    /**
     * @notice Trigger the scheduled burn. Burns proportional to time elapsed
     *         since last burn. Caller receives a reward.
     * @return burnAmount How many tokens were burned
     */
    function burn() external nonReentrant returns (uint256 burnAmount) {
        require(active, "Burner is paused");

        uint256 elapsed = block.timestamp - lastBurnTime;
        require(elapsed > 0, "Too soon");

        // Calculate burn: (burnRatePerHour * elapsed) / 3600
        burnAmount = (burnRatePerHour * elapsed) / 3600;

        uint256 balance = clawd.balanceOf(address(this));
        uint256 totalNeeded = burnAmount + callerReward;

        // If not enough balance, burn what we can and adjust reward
        if (totalNeeded > balance) {
            if (balance > callerReward) {
                burnAmount = balance - callerReward;
            } else {
                // Not even enough for reward — burn everything, no reward
                burnAmount = balance;
                totalNeeded = burnAmount;
            }
        }

        require(burnAmount > 0, "Nothing to burn");

        lastBurnTime = block.timestamp;
        totalBurned += burnAmount;

        // Send tokens to dead address (burn)
        clawd.safeTransfer(DEAD, burnAmount);

        // Pay caller reward (if affordable)
        uint256 rewardPaid = 0;
        uint256 remainingBalance = clawd.balanceOf(address(this));
        if (remainingBalance >= callerReward) {
            rewardPaid = callerReward;
            clawd.safeTransfer(msg.sender, rewardPaid);
        }

        emit Burned(msg.sender, burnAmount, rewardPaid, elapsed);
    }

    // ── View: Pending burn ──────────────────────────────────────
    /**
     * @notice How many tokens would be burned if burn() is called now
     */
    function pendingBurn() external view returns (uint256) {
        if (!active) return 0;
        uint256 elapsed = block.timestamp - lastBurnTime;
        uint256 pending = (burnRatePerHour * elapsed) / 3600;
        uint256 balance = clawd.balanceOf(address(this));
        if (pending + callerReward > balance) {
            pending = balance > callerReward ? balance - callerReward : balance;
        }
        return pending;
    }

    /**
     * @notice Seconds since last burn
     */
    function timeSinceLastBurn() external view returns (uint256) {
        return block.timestamp - lastBurnTime;
    }

    /**
     * @notice Contract CLAWD balance
     */
    function contractBalance() external view returns (uint256) {
        return clawd.balanceOf(address(this));
    }

    /**
     * @notice Estimated hourly burn in CLAWD (for display)
     */
    function hourlyBurnRate() external view returns (uint256) {
        return burnRatePerHour;
    }

    // ── Admin ───────────────────────────────────────────────────
    function toggle() external onlyOwner {
        active = !active;
        emit Toggled(active);
    }

    function setBurnRate(uint256 _newRate) external onlyOwner {
        // Settle any pending burn first at old rate
        if (active && block.timestamp > lastBurnTime) {
            _settlePending();
        }
        burnRatePerHour = _newRate;
        emit BurnRateUpdated(_newRate);
    }

    function setCallerReward(uint256 _newReward) external onlyOwner {
        callerReward = _newReward;
        emit CallerRewardUpdated(_newReward);
    }

    /**
     * @notice Emergency withdraw — admin can pull tokens out
     */
    function withdraw(uint256 amount) external onlyOwner {
        clawd.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    // ── Internal ────────────────────────────────────────────────
    function _settlePending() internal {
        uint256 elapsed = block.timestamp - lastBurnTime;
        if (elapsed == 0) return;
        uint256 burnAmount = (burnRatePerHour * elapsed) / 3600;
        uint256 balance = clawd.balanceOf(address(this));
        if (burnAmount > balance) burnAmount = balance;
        if (burnAmount > 0) {
            lastBurnTime = block.timestamp;
            totalBurned += burnAmount;
            clawd.safeTransfer(DEAD, burnAmount);
            emit Burned(address(this), burnAmount, 0, elapsed);
        }
    }
}
