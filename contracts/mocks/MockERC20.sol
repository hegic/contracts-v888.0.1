pragma solidity ^0.7.5;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        _setupDecimals(_decimals);
    }

    /**
     * @notice Mint tokens
     * @param _to who tokens should be minted to
     * @param _amount amount to mint
     */
    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}
