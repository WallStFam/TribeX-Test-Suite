# TribeX-Test-Suite

## Introduction
This is an audit of the Tribe X / Empire smart contract(https://etherscan.io/address/0xff9981d2c6c6d612e03e4a32f5488e552eeae285) to identify vulnerabilities.

We analysed the code and wrote a set of unit tests to check that every feature of the smart contract works as expected.

We paid special attention to mint and withdraw functions to evaluate if opening the mint back again would be safe for both users and developers.

From analysing the code we found only a few minor details: there are some unused variables and a duplicated function. Besides that, this is a standard NFT collection contract that uses standard and tested libraries from OpenZeppelin and ERC721A.

For those standard libraries we made sure they are exactly the ones provided by OpenZeppelin and Azuki and that they haven't been tampered with by malicious actors.

## Out of Scope
Note that the unit tests below does not include nor addresses any issues that may happen during the deployment process or the security of the owner's or deployer's private keys. Meaning that even if the smart contract code is secure, but if the deployment or the security of the owner's wallet is compromised, then this mean that the funds in the smart contract or any `onlyOwner` functions would be compromised as well.  

## Tests (In Scope)

Following a code analysis, we wrote a comprehensive list of unit tests to guarantee through code that all functions work as expected.

Here is the list of tests we ran against the smart contract:

    Whitelist OG
      ✔ Only the owner can set a new OG whitelist (46ms)
      ✔ Can only mint if in OG whitelist
      ✔ If setting a new OG whitelist, users that were whitelisted previously are not whitelisted anymore (142ms)
      ✔ Should fail to mint if OG sales are inactive
      ✔ Should succeed to mint if OG sales are active
      ✔ Cannot mint more than max mint amount
      ✔ Cannot mint more than address max amount
      ✔ Cannot mint more than collection max supply (712ms)
      ✔ Should fail if payed value is low

    Whitelist
      ✔ Only the owner can set a new whitelist
      ✔ Can only mint if in whitelist
      ✔ If setting a new whitelist, users that were whitelisted previously are not whitelisted anymore (134ms)
      ✔ Should fail to mint if sales are inactive
      ✔ Should succeed to mint if sales are active
      ✔ Cannot mint more than max mint amount
      ✔ Cannot mint more than address max amount
      ✔ Cannot mint more than collection max supply (681ms)
      ✔ Should fail if payed value is low

    Public Sale
      ✔ Should fail to mint if sales are inactive
      ✔ Should succeed if public sale is active
      ✔ Users cannot mint more than max amount per transaction
      ✔ Cannot mint more than address max amount
      ✔ Cannot mint more than collection max supply (633ms)
      ✔ Should fail if payed value is low

    Minting
      ✔ Should fail if mint amount is less than 1
      ✔ Should be able to mint if value is equal to the required amount (47ms)
      ✔ Should be able to mint if value is more than the required amount (47ms)
      ✔ reserveMint can only be called by owner
      ✔ airdropMint can only be called by owner
      ✔ Only owner can set minting costs (41ms)
      ✔ Only owner can set max mint amounts (47ms)
      ✔ Owner can reduce supply limit
      ✔ If all sales are on, users can mint in whitelist and public sale

    Metadata
      ✔ Tokens have the correct metadata URI (61ms)
      ✔ Only owner can set baseURI

    Withdraw
      ✔ Calling withdraw should send 100% AA_ADDRESS
      ✔ Calling emergencyWithdraw should send 100% owner (42ms)
      ✔ Only owner can call emergencyWithdraw
      ✔ Only owner can call withdraw

You can find the code of all tests in test/Empire.test.js.

If you'd like to run the tests yourself, clone this repository and run the following commands from inside the repository's directory:

```js
yarn //to install dependencies

npx hardhat test //to run the test suite
```


## Conclusion

Based on our analysis and tests we could not find any vulnerabilities and commit that the contract is deemed safe for reopening the mint.
