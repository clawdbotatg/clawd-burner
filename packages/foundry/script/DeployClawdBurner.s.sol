// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import "../contracts/CLAWDBurner.sol";

contract DeployClawdBurner is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // CLAWD token on Base
        address clawdToken = 0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07;

        // 500,000 CLAWD per hour (18 decimals)
        uint256 burnRatePerHour = 500_000 * 1e18;

        // 5,000 CLAWD caller reward (18 decimals)
        uint256 callerReward = 5_000 * 1e18;

        // Owner = Clawd's main wallet
        address owner = 0x11ce532845cE0eAcdA41f72FDc1C88c335981442;

        CLAWDBurner burner = new CLAWDBurner(clawdToken, burnRatePerHour, callerReward, owner);

        console.logString(string.concat("CLAWDBurner deployed at: ", vm.toString(address(burner))));
    }
}
