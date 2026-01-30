//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployClawdBurner } from "./DeployClawdBurner.s.sol";

contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        DeployClawdBurner deployBurner = new DeployClawdBurner();
        deployBurner.run();
    }
}
