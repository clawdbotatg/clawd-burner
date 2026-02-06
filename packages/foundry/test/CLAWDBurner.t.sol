// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/CLAWDBurner.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Simple mock ERC20 for testing
contract MockCLAWD is ERC20 {
    constructor() ERC20("CLAWD", "CLAWD") {
        _mint(msg.sender, 100_000_000_000 * 1e18); // 100B tokens
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CLAWDBurnerTest is Test {
    CLAWDBurner public burner;
    MockCLAWD public clawd;

    address public owner = address(0xBEEF);
    address public caller1 = address(0xCAFE);
    address public caller2 = address(0xFACE);

    address constant DEAD = 0x000000000000000000000000000000000000dEaD;

    uint256 constant BURN_RATE = 500_000 * 1e18;  // 500k/hr
    uint256 constant CALLER_REWARD = 5_000 * 1e18; // 5k reward

    function setUp() public {
        clawd = new MockCLAWD();
        burner = new CLAWDBurner(address(clawd), BURN_RATE, CALLER_REWARD, owner);

        // Fund the burner with 10M CLAWD
        clawd.transfer(address(burner), 10_000_000 * 1e18);
    }

    // ── Basic Functionality ─────────────────────────────────────

    function test_InitialState() public view {
        assertTrue(burner.active());
        assertEq(burner.burnRatePerHour(), BURN_RATE);
        assertEq(burner.callerReward(), CALLER_REWARD);
        assertEq(burner.totalBurned(), 0);
        assertEq(burner.contractBalance(), 10_000_000 * 1e18);
    }

    function test_BurnAfterOneHour() public {
        // Advance 1 hour
        vm.warp(block.timestamp + 3600);

        uint256 callerBalBefore = clawd.balanceOf(caller1);
        uint256 deadBalBefore = clawd.balanceOf(DEAD);

        vm.prank(caller1);
        uint256 burned = burner.burn();

        assertEq(burned, BURN_RATE); // 500k burned
        assertEq(clawd.balanceOf(caller1) - callerBalBefore, CALLER_REWARD); // 5k reward
        assertEq(clawd.balanceOf(DEAD) - deadBalBefore, BURN_RATE); // 500k to dead
        assertEq(burner.totalBurned(), BURN_RATE);
    }

    function test_BurnAfterHalfHour() public {
        // Advance 30 min
        vm.warp(block.timestamp + 1800);

        vm.prank(caller1);
        uint256 burned = burner.burn();

        // Half of 500k = 250k
        assertEq(burned, 250_000 * 1e18);
        assertEq(burner.totalBurned(), 250_000 * 1e18);
    }

    function test_BurnMultipleTimes() public {
        // First burn after 1 hour
        vm.warp(block.timestamp + 3600);
        vm.prank(caller1);
        burner.burn();

        // Second burn after another 2 hours
        vm.warp(block.timestamp + 7200);
        vm.prank(caller2);
        uint256 burned = burner.burn();

        assertEq(burned, 1_000_000 * 1e18); // 2 hours worth
        assertEq(burner.totalBurned(), 1_500_000 * 1e18); // 500k + 1M
    }

    function test_PendingBurn() public {
        vm.warp(block.timestamp + 3600);
        uint256 pending = burner.pendingBurn();
        assertEq(pending, BURN_RATE);
    }

    function test_TimeSinceLastBurn() public {
        vm.warp(block.timestamp + 3600);
        assertEq(burner.timeSinceLastBurn(), 3600);
    }

    // ── Edge Cases ──────────────────────────────────────────────

    function test_RevertWhenPaused() public {
        vm.prank(owner);
        burner.toggle();

        vm.warp(block.timestamp + 3600);

        vm.prank(caller1);
        vm.expectRevert("Burner is paused");
        burner.burn();
    }

    function test_RevertWhenTooSoon() public {
        vm.prank(caller1);
        vm.expectRevert("Too soon");
        burner.burn();
    }

    function test_BurnWithLowBalance() public {
        // Withdraw most tokens, leave just 100k
        vm.prank(owner);
        burner.withdraw(9_900_000 * 1e18);

        // Try to burn after 1 hour (would need 505k but only 100k available)
        vm.warp(block.timestamp + 3600);

        vm.prank(caller1);
        uint256 burned = burner.burn();

        // Should burn what's available minus reward
        assertEq(burned, 95_000 * 1e18); // 100k - 5k reward
        assertEq(clawd.balanceOf(caller1), CALLER_REWARD);
    }

    function test_BurnWithTinyBalance() public {
        // Leave just 1k CLAWD (less than reward)
        vm.prank(owner);
        burner.withdraw(9_999_000 * 1e18);

        vm.warp(block.timestamp + 3600);

        vm.prank(caller1);
        uint256 burned = burner.burn();

        // Burns everything, no reward (not enough for reward)
        assertEq(burned, 1_000 * 1e18);
        assertEq(clawd.balanceOf(caller1), 0); // No reward paid
    }

    // ── Admin Functions ─────────────────────────────────────────

    function test_Toggle() public {
        assertTrue(burner.active());

        vm.prank(owner);
        burner.toggle();
        assertFalse(burner.active());

        vm.prank(owner);
        burner.toggle();
        assertTrue(burner.active());
    }

    function test_SetBurnRate() public {
        vm.prank(owner);
        burner.setBurnRate(1_000_000 * 1e18);
        assertEq(burner.burnRatePerHour(), 1_000_000 * 1e18);
    }

    function test_SetCallerReward() public {
        vm.prank(owner);
        burner.setCallerReward(10_000 * 1e18);
        assertEq(burner.callerReward(), 10_000 * 1e18);
    }

    function test_Withdraw() public {
        uint256 ownerBalBefore = clawd.balanceOf(owner);

        vm.prank(owner);
        burner.withdraw(1_000_000 * 1e18);

        assertEq(clawd.balanceOf(owner) - ownerBalBefore, 1_000_000 * 1e18);
    }

    function test_OnlyOwnerToggle() public {
        vm.prank(caller1);
        vm.expectRevert();
        burner.toggle();
    }

    function test_OnlyOwnerSetBurnRate() public {
        vm.prank(caller1);
        vm.expectRevert();
        burner.setBurnRate(1e18);
    }

    function test_OnlyOwnerWithdraw() public {
        vm.prank(caller1);
        vm.expectRevert();
        burner.withdraw(1e18);
    }

    // ── Rate Change Settles Pending ─────────────────────────────

    function test_SetBurnRateSettlesPending() public {
        // Advance 1 hour
        vm.warp(block.timestamp + 3600);

        uint256 deadBefore = clawd.balanceOf(DEAD);

        // Change rate — should settle pending first
        vm.prank(owner);
        burner.setBurnRate(1_000_000 * 1e18);

        // The pending 500k should have been burned
        assertEq(clawd.balanceOf(DEAD) - deadBefore, BURN_RATE);
        assertEq(burner.totalBurned(), BURN_RATE);
    }

    // ── Fuzz Tests ──────────────────────────────────────────────

    function testFuzz_BurnProportionalToTime(uint256 elapsed) public {
        // Bound elapsed to 1 second - 30 days
        elapsed = bound(elapsed, 1, 30 days);

        vm.warp(block.timestamp + elapsed);

        uint256 expectedBurn = (BURN_RATE * elapsed) / 3600;
        uint256 balance = clawd.balanceOf(address(burner));

        // Cap at available balance
        if (expectedBurn + CALLER_REWARD > balance) {
            if (balance > CALLER_REWARD) {
                expectedBurn = balance - CALLER_REWARD;
            } else {
                expectedBurn = balance;
            }
        }

        vm.prank(caller1);
        uint256 burned = burner.burn();

        assertEq(burned, expectedBurn);
    }
}
