// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ClawdBurner
 * @notice Burns $CLAWD tokens on a schedule with caller incentives
 * @dev Admin deposits CLAWD, anyone can trigger burns and earn rewards
 *
 * Burn rate: 500,000 CLAWD/hour (configurable)
 * Caller reward: 5,000 CLAWD per burn call
 * Burns are sent to the dead address (0x000...dEaD)
 */
contract ClawdBurner is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- Constants ---
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // --- State ---
    IERC20 public immutable clawdToken;

    uint256 public burnRatePerHour; // tokens per hour (in wei)
    uint256 public callerReward;    // reward per burn call (in wei)
    bool public burnsEnabled;
    uint256 public lastBurnTimestamp;
    uint256 public totalBurned;
    uint256 public totalBurnCalls;

    // --- Events ---
    event BurnExecuted(address indexed caller, uint256 burnAmount, uint256 callerReward, uint256 timestamp);
    event BurnRateUpdated(uint256 oldRate, uint256 newRate);
    event CallerRewardUpdated(uint256 oldReward, uint256 newReward);
    event BurnsToggled(bool enabled);
    event TokensDeposited(address indexed depositor, uint256 amount);
    event TokensWithdrawn(address indexed to, uint256 amount);

    // --- Errors ---
    error BurnsNotEnabled();
    error NothingToBurn();
    error InsufficientBalance();

    constructor(
        address _clawdToken,
        uint256 _burnRatePerHour,
        uint256 _callerReward
    ) Ownable(msg.sender) {
        clawdToken = IERC20(_clawdToken);
        burnRatePerHour = _burnRatePerHour;
        callerReward = _callerReward;
        burnsEnabled = true;
        lastBurnTimestamp = block.timestamp;
    }

    // --- Public Functions ---

    /**
     * @notice Execute a burn. Anyone can call this.
     * @dev Burns accumulated tokens and rewards the caller.
     */
    function burn() external nonReentrant {
        if (!burnsEnabled) revert BurnsNotEnabled();

        uint256 burnAmount = pendingBurnAmount();
        if (burnAmount == 0) revert NothingToBurn();

        uint256 balance = clawdToken.balanceOf(address(this));
        uint256 totalNeeded = burnAmount + callerReward;

        // If not enough for full burn + reward, burn what we can
        if (balance < totalNeeded) {
            if (balance <= callerReward) revert InsufficientBalance();
            burnAmount = balance - callerReward;
        }

        // Update state before external calls (CEI pattern)
        lastBurnTimestamp = block.timestamp;
        totalBurned += burnAmount;
        totalBurnCalls += 1;

        // Transfer to dead address (burn)
        clawdToken.safeTransfer(DEAD_ADDRESS, burnAmount);

        // Reward the caller
        clawdToken.safeTransfer(msg.sender, callerReward);

        emit BurnExecuted(msg.sender, burnAmount, callerReward, block.timestamp);
    }

    /**
     * @notice Calculate how many tokens are pending to be burned
     */
    function pendingBurnAmount() public view returns (uint256) {
        if (!burnsEnabled) return 0;
        uint256 elapsed = block.timestamp - lastBurnTimestamp;
        return (burnRatePerHour * elapsed) / 1 hours;
    }

    /**
     * @notice Time until next meaningful burn (at least 1 token)
     */
    function timeUntilNextBurn() public view returns (uint256) {
        if (!burnsEnabled) return type(uint256).max;
        // Minimum time for at least 1 token worth of burn
        uint256 minTime = (1 hours) / burnRatePerHour;
        if (minTime == 0) minTime = 1;
        uint256 elapsed = block.timestamp - lastBurnTimestamp;
        if (elapsed >= minTime) return 0;
        return minTime - elapsed;
    }

    /**
     * @notice Get contract's CLAWD balance
     */
    function contractBalance() external view returns (uint256) {
        return clawdToken.balanceOf(address(this));
    }

    // --- Admin Functions ---

    function setBurnRate(uint256 _newRate) external onlyOwner {
        emit BurnRateUpdated(burnRatePerHour, _newRate);
        burnRatePerHour = _newRate;
    }

    function setCallerReward(uint256 _newReward) external onlyOwner {
        emit CallerRewardUpdated(callerReward, _newReward);
        callerReward = _newReward;
    }

    function toggleBurns() external onlyOwner {
        burnsEnabled = !burnsEnabled;
        if (burnsEnabled) {
            lastBurnTimestamp = block.timestamp; // Reset timer when re-enabling
        }
        emit BurnsToggled(burnsEnabled);
    }

    /**
     * @notice Emergency withdraw tokens (admin only)
     */
    function withdrawTokens(uint256 _amount) external onlyOwner {
        clawdToken.safeTransfer(msg.sender, _amount);
        emit TokensWithdrawn(msg.sender, _amount);
    }
}
