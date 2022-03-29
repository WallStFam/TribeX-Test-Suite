const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const { getMerkleTreeFromWhitelist, getHexProof } = require("../scripts/utils");

function generateRandomAddresses(count) {
    let addrs = [];
    for (let i = 0; i < count; i++) {
        addrs.push(ethers.Wallet.createRandom().address);
    }
    return addrs;
}

describe("Tribe-X", function () {
    let contract, owner;
    let rootHash, rootHashHex, whitelist;
    let rootHashOG, rootHashHexOG, whitelistOG;
    let hexProof;

    let maxSupply;

    const aa = "0xaBffc43Bafd9c811a351e7051feD9d8be2ad082f";

    let costWhitelistedOG;
    let costWhitelisted;
    let costPublicSale;

    let maxMintAmountWhitelistOG;
    let maxMintAmountWhitelist;
    let maxMintAmountPublicSale;
    let maxPerAddress;

    const notRevealedURI = "https://baseURI/notRevealed_";
    const baseURI = "https://baseURI/";

    function etherPrice(price, mul = 1) {
        return ethers.utils.parseEther(price.toString()).mul(mul).toString();
    }

    beforeEach(async () => {
        [owner, alice, bob, charlie, dennis, eric, _] = await ethers.getSigners();

        const Empire = await ethers.getContractFactory("Empire");
        contract = await Empire.deploy();
        await contract.deployed();

        // There are 3 whitelists: whitelist Super Frens, normal whitelist and whitelist for free nint with dads
        whitelistOG = [alice.address, bob.address];
        const merkleTreeOG = getMerkleTreeFromWhitelist(whitelistOG);
        rootHashOG = merkleTreeOG.getRoot();
        rootHashHexOG = "0x" + rootHashOG.toString("hex");

        whitelist = [alice.address, charlie.address];
        const merkleTree = getMerkleTreeFromWhitelist(whitelist);
        rootHash = merkleTree.getRoot();
        rootHashHex = "0x" + rootHash.toString("hex");

        await contract.setOGMerkleRoot(rootHashOG);
        await contract.setWLMerkleRoot(rootHash);

        await contract.setBaseURI(notRevealedURI);

        maxMintAmountWhitelistOG = (await contract.ADDRESS_OG_MAX_MINTS()).toNumber();
        maxMintAmountWhitelist = (await contract.ADDRESS_WL_MAX_MINTS()).toNumber();
        maxMintAmountPublicSale = (await contract.PUBLIC_MINT_PER_TX()).toNumber();
        maxPerAddress = (await contract.ADDRESS_MAX_MINTS()).toNumber();

        maxSupply = (await contract.maxSupply()).toNumber();

        costWhitelistedOG = ethers.utils.formatEther(await contract.OGprice());
        costWhitelisted = ethers.utils.formatEther(await contract.WLprice());
        costPublicSale = ethers.utils.formatEther(await contract.price());
    });

    describe("Whitelist OG", () => {
        it("Only the owner can set a new OG whitelist", async () => {
            await contract.setOGMerkleRoot(rootHashOG);
            expect(await contract.OGMerkleRoot()).to.equal(rootHashHexOG);

            let randomAddress = ethers.Wallet.createRandom().address;
            await expect(contract.connect(randomAddress).setOGMerkleRoot(rootHashOG)).to.be.reverted;
        });

        it("Can only mint if in OG whitelist", async () => {
            await contract.setOnlyOG();

            // alice is in whitelist
            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) });

            // charlie is not in whitelist
            hexProof = getHexProof(whitelistOG, charlie.address);
            await expect(contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) })).to.be
                .reverted;
        });

        it("If setting a new OG whitelist, users that were whitelisted previously are not whitelisted anymore", async () => {
            await contract.setOnlyOG();
            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) }); // this works

            const newWhitelist = generateRandomAddresses(10); // create a new whitelist with only random addresses
            const newMerkleTree = getMerkleTreeFromWhitelist(newWhitelist);
            await contract.setOGMerkleRoot(newMerkleTree.getRoot());

            hexProof = getHexProof(newWhitelist, alice.address);
            expect(hexProof.length).to.equal(0);
            await expect(contract.connect(alice).mintOGSale(1, hexProof)).to.be.reverted;
        });

        it("Should fail to mint if OG sales are inactive", async () => {
            await contract.toggleSaleOff();

            hexProof = getHexProof(whitelistOG, alice.address);
            await expect(
                contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) })
            ).to.be.revertedWith("Family presale must be active to mint");
        });

        it("Should succeed to mint if OG sales are active", async () => {
            await contract.setOnlyOG();

            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);
        });

        it("Cannot mint more than max mint amount", async () => {
            await contract.setOnlyOG();

            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(maxMintAmountWhitelistOG - 1, hexProof, {
                value: etherPrice(costWhitelistedOG, maxMintAmountWhitelistOG - 1),
            });
            await expect(
                contract.connect(alice).mintOGSale(2, hexProof, {
                    value: etherPrice(costWhitelistedOG, 2),
                })
            ).to.be.revertedWith("You are trying to mint more than their whitelist amount");
        });

        it("Cannot mint more than address max amount", async () => {
            await contract.setOnlyOG();
            await contract.setOGMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(maxPerAddress - 1, hexProof, {
                value: etherPrice(costWhitelistedOG, maxPerAddress - 1),
            });
            await expect(
                contract.connect(alice).mintOGSale(2, hexProof, {
                    value: etherPrice(costWhitelistedOG, 2),
                })
            ).to.be.revertedWith("You are trying to mint more than allocated tokens");
        });

        it("Cannot mint more than collection max supply", async () => {
            await contract.setOnlyOG();
            await contract.setOGMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached
            await contract.setMaxAddress(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(maxSupply - 1, hexProof, {
                value: etherPrice(costWhitelistedOG, maxSupply - 1),
            });

            await expect(
                contract.connect(alice).mintOGSale(2, hexProof, {
                    value: etherPrice(costWhitelistedOG, 2),
                })
            ).to.be.revertedWith("This would exceed the max number of mints allowed");
        });

        it("Should fail if payed value is low", async () => {
            await contract.setOnlyOG();

            hexProof = getHexProof(whitelistOG, alice.address);
            await expect(
                contract.connect(alice).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG * 0.9) })
            ).to.be.revertedWith("Not enough ether to mint, please add more eth to your wallet");
        });
    });

    describe("Whitelist", () => {
        it("Only the owner can set a new whitelist", async () => {
            await contract.setWLMerkleRoot(rootHash);
            expect(await contract.WLMerkleRoot()).to.equal(rootHashHex);

            let randomAddress = ethers.Wallet.createRandom().address;
            await expect(contract.connect(randomAddress).setWLMerkleRoot(rootHash)).to.be.reverted;
        });

        it("Can only mint if in whitelist", async () => {
            await contract.setOnlyWhitelisted();

            // alice is in whitelist
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) });

            // charlie is not in whitelist
            hexProof = getHexProof(whitelist, charlie.address);
            await expect(contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) })).to.be.reverted;
        });

        it("If setting a new whitelist, users that were whitelisted previously are not whitelisted anymore", async () => {
            await contract.setOnlyWhitelisted();

            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) }); // this works

            const newWhitelist = generateRandomAddresses(10); // create a new whitelist with only random addresses
            const newMerkleTree = getMerkleTreeFromWhitelist(newWhitelist);
            await contract.setWLMerkleRoot(newMerkleTree.getRoot());

            hexProof = getHexProof(newWhitelist, alice.address);
            expect(hexProof.length).to.equal(0);
            await expect(contract.connect(alice).mintWLSale(1, hexProof)).to.be.reverted;
        });

        it("Should fail to mint if sales are inactive", async () => {
            await contract.toggleSaleOff();

            hexProof = getHexProof(whitelist, alice.address);
            await expect(
                contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) })
            ).to.be.revertedWith("Sale must be active before you can mint");
        });

        it("Should succeed to mint if sales are active", async () => {
            await contract.setOnlyWhitelisted();

            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);
        });

        it("Cannot mint more than max mint amount", async () => {
            await contract.setOnlyWhitelisted();

            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(maxMintAmountWhitelist - 1, hexProof, {
                value: etherPrice(costWhitelisted, maxMintAmountWhitelist - 1),
            });
            await expect(
                contract.connect(alice).mintWLSale(2, hexProof, {
                    value: etherPrice(costWhitelisted, 2),
                })
            ).to.be.revertedWith("Sender is trying to mint more than their whitelist amount");
        });

        it("Cannot mint more than address max amount", async () => {
            await contract.setOnlyWhitelisted();
            await contract.setWLMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(maxPerAddress - 1, hexProof, {
                value: etherPrice(costWhitelisted, maxPerAddress - 1),
            });
            await expect(
                contract.connect(alice).mintWLSale(2, hexProof, {
                    value: etherPrice(costWhitelisted, 2),
                })
            ).to.be.revertedWith("Sender is trying to mint more than allocated tokens");
        });

        it("Cannot mint more than collection max supply", async () => {
            await contract.setOnlyWhitelisted();
            await contract.setWLMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached
            await contract.setMaxAddress(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(maxSupply - 1, hexProof, {
                value: etherPrice(costWhitelisted, maxSupply - 1),
            });

            await expect(
                contract.connect(alice).mintWLSale(2, hexProof, {
                    value: etherPrice(costWhitelisted, 2),
                })
            ).to.be.revertedWith("Mint would exceed max supply of mints");
        });

        it("Should fail if payed value is low", async () => {
            await contract.setOnlyWhitelisted();

            hexProof = getHexProof(whitelist, alice.address);
            await expect(
                contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted * 0.9) })
            ).to.be.revertedWith("Amount of ether is not enough to mint, please send more eth based on price");
        });
    });

    describe("Public Sale", () => {
        it("Should fail to mint if sales are inactive", async () => {
            await contract.toggleSaleOff();

            await expect(contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale) })).to.be.revertedWith(
                "Public sale must be active to mint"
            );
        });

        it("Should succeed if public sale is active", async () => {
            await contract.setOnlyPublicSale();

            await contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        it("Users cannot mint more than max amount per transaction", async () => {
            await contract.setOnlyPublicSale();
            await contract.setMaxAddress(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            contract.connect(alice).mint(maxMintAmountPublicSale, { value: etherPrice(costPublicSale, maxMintAmountPublicSale) });

            contract.connect(alice).mint(maxMintAmountPublicSale, { value: etherPrice(costPublicSale, maxMintAmountPublicSale) });

            await expect(
                contract.connect(alice).mint(maxMintAmountPublicSale + 1, {
                    value: etherPrice(costPublicSale, maxMintAmountPublicSale + 1),
                })
            ).to.be.revertedWith("Sender is trying to mint too many in a single transaction, please reduce qty");
        });

        it("Cannot mint more than address max amount", async () => {
            await contract.setOnlyPublicSale();
            await contract.setPublicMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            await contract.connect(alice).mint(maxPerAddress - 1, {
                value: etherPrice(costPublicSale, maxPerAddress - 1),
            });
            await expect(
                contract.connect(alice).mint(2, {
                    value: etherPrice(costPublicSale, 2),
                })
            ).to.be.revertedWith("Sender is trying to mint more than allocated tokens");
        });

        it("Cannot mint more than collection max supply", async () => {
            await contract.setOnlyPublicSale();
            await contract.setPublicMax(maxSupply + 100); // set more than maxAmount so this max limit is not reached
            await contract.setMaxAddress(maxSupply + 100); // set more than maxAmount so this max limit is not reached

            await contract.connect(alice).mint(maxSupply - 1, {
                value: etherPrice(costPublicSale, maxSupply - 1),
            });

            await expect(
                contract.connect(alice).mint(2, {
                    value: etherPrice(costPublicSale, 2),
                })
            ).to.be.revertedWith("Mint would exceed max supply of mints");
        });

        it("Should fail if payed value is low", async () => {
            await contract.setOnlyPublicSale();
            await expect(contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale * 0.9) })).to.be.revertedWith(
                "Amount of ether is not enough, please add more eth"
            );
        });
    });

    describe("Minting", () => {
        it("Should fail if mint amount is less than 1", async () => {
            await contract.setOnlyPublicSale();
            await expect(contract.connect(alice).mint(0)).to.be.revertedWith("Sender is trying to mint zero");
        });

        it("Should be able to mint if value is equal to the required amount", async () => {
            // check for all mint types
            await contract.setOnlyOG();
            hexProof = getHexProof(whitelistOG, bob.address);
            await contract.connect(bob).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG) });
            expect(await contract.balanceOf(bob.address)).to.equal(1);

            await contract.setOnlyWhitelisted();
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);

            await contract.setOnlyPublicSale();
            await contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        it("Should be able to mint if value is more than the required amount", async () => {
            // check for all mint types
            await contract.setOnlyOG();
            hexProof = getHexProof(whitelistOG, bob.address);
            await contract.connect(bob).mintOGSale(1, hexProof, { value: etherPrice(costWhitelistedOG + 1) });
            expect(await contract.balanceOf(bob.address)).to.equal(1);

            await contract.setOnlyWhitelisted();
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, { value: etherPrice(costWhitelisted + 1) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);

            await contract.setOnlyPublicSale();
            await contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale + 1) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        it("reserveMint can only be called by owner", async () => {
            await contract.reserveMint(1, charlie.address);
            expect(await contract.balanceOf(charlie.address)).to.be.equal(1);
            await expect(contract.connect(alice).reserveMint(1, charlie.address)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("airdropMint can only be called by owner", async () => {
            await contract.airdropMint(1, bob.address);
            expect(await contract.balanceOf(bob.address)).to.be.equal(1);
            await expect(contract.connect(alice).airdropMint(1, bob.address)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("Only owner can set minting costs", async () => {
            const newWhitelistedOGCost = costWhitelistedOG * 2;
            const newWhitelistedCost = costWhitelisted * 2;
            const newPublicSaleCost = costPublicSale * 2;

            await expect(contract.connect(alice).setOGprice(etherPrice(newWhitelistedOGCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setWLprice(etherPrice(newWhitelistedCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setMintPrice(etherPrice(newPublicSaleCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );

            await contract.setOGprice(etherPrice(newWhitelistedOGCost));
            await contract.setWLprice(etherPrice(newWhitelistedCost));
            await contract.setMintPrice(etherPrice(newPublicSaleCost));

            expect(await contract.OGprice()).to.be.equal(etherPrice(newWhitelistedOGCost));
            expect(await contract.WLprice()).to.be.equal(etherPrice(newWhitelistedCost));
            expect(await contract.price()).to.be.equal(etherPrice(newPublicSaleCost));
        });

        it("Only owner can set max mint amounts", async () => {
            const newMaxMintAmountWhitelistOG = maxMintAmountWhitelistOG * 2;
            const newMaxMintAmountWhitelist = maxMintAmountWhitelist * 2;
            const newMaxMintAmountPublicSale = maxMintAmountPublicSale * 2;
            const newMaxPerAddress = maxPerAddress * 2;

            await expect(contract.connect(alice).setOGMax(newMaxMintAmountWhitelistOG)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setWLMax(newMaxMintAmountWhitelist)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setPublicMax(newMaxMintAmountPublicSale)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setMaxAddress(newMaxPerAddress)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );

            await contract.setOGMax(newMaxMintAmountWhitelistOG);
            await contract.setWLMax(newMaxMintAmountWhitelist);
            await contract.setPublicMax(newMaxMintAmountPublicSale);
            await contract.setMaxAddress(newMaxPerAddress);

            expect(await contract.ADDRESS_OG_MAX_MINTS()).to.be.equal(newMaxMintAmountWhitelistOG);
            expect(await contract.ADDRESS_WL_MAX_MINTS()).to.be.equal(newMaxMintAmountWhitelist);
            expect(await contract.PUBLIC_MINT_PER_TX()).to.be.equal(newMaxMintAmountPublicSale);
            expect(await contract.ADDRESS_MAX_MINTS()).to.be.equal(newMaxPerAddress);
        });

        it("Owner can reduce supply limit", async () => {
            await contract.changeSupplyLimit(3);
            expect(await contract.maxSupply()).to.be.equal(3);

            await contract.toggleAllsaleOn();

            await contract.connect(charlie).mint(3, { value: etherPrice(costPublicSale, 3) });

            // Checck that cannot mint any more tokens in any sale
            await expect(contract.connect(charlie).mint(1, { value: etherPrice(costPublicSale, 1) })).to.be.revertedWith(
                "Mint would exceed max supply of mints"
            );

            hexProof = getHexProof(whitelistOG, alice.address);
            await expect(
                contract.connect(alice).mintOGSale(1, hexProof, {
                    value: etherPrice(costWhitelistedOG, 1),
                })
            ).to.be.revertedWith("This would exceed the max number of mints allowed");

            hexProof = getHexProof(whitelist, alice.address);
            await expect(
                contract.connect(alice).mintWLSale(1, hexProof, {
                    value: etherPrice(costWhitelisted, 1),
                })
            ).to.be.revertedWith("Mint would exceed max supply of mints");
        });

        it("If all sales are on, users can mint in whitelist and public sale", async () => {
            await contract.toggleAllsaleOn();

            // Use alice because she is in both whitelists

            hexProof = getHexProof(whitelistOG, alice.address);
            await contract.connect(alice).mintOGSale(1, hexProof, {
                value: etherPrice(costWhitelistedOG),
            });
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWLSale(1, hexProof, {
                value: etherPrice(costWhitelisted),
            });
            await contract.connect(alice).mint(1, { value: etherPrice(costPublicSale) });

            expect(await contract.balanceOf(alice.address)).to.be.equal(3);
        });
    });

    describe("Metadata", () => {
        it("Tokens have the correct metadata URI", async () => {
            await contract.setOnlyPublicSale();

            await contract.mint(5, { value: etherPrice(costPublicSale, 5) });

            for (let i = 1; i <= 5; i++) {
                expect(await contract.tokenURI(i)).to.equal(notRevealedURI + i);
            }

            await contract.setBaseURI(baseURI);
            for (let i = 1; i <= 5; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i);
            }
        });

        it("Only owner can set baseURI", async () => {
            await expect(contract.connect(alice).setBaseURI(baseURI)).to.be.revertedWith("Ownable: caller is not the owner");
            await contract.setBaseURI(baseURI); // this works
        });
    });

    describe("Withdraw", async () => {
        it("Calling withdraw should send 100% AA_ADDRESS", async () => {
            await contract.setOnlyPublicSale();

            await contract.connect(alice).mint(10, {
                value: etherPrice(costPublicSale, 10),
            });

            let contractBalance = await ethers.provider.getBalance(contract.address);
            await contract.withdraw();

            const aaBalance = await ethers.provider.getBalance(aa);
            expect(aaBalance).to.be.equal(contractBalance);

            contractBalance = await ethers.provider.getBalance(contract.address);
            expect(contractBalance).to.be.equal(0);
        });

        it("Calling emergencyWithdraw should send 100% owner", async () => {
            await contract.setOnlyPublicSale();

            await contract.connect(alice).mint(10, {
                value: etherPrice(costPublicSale, 10),
            });

            let contractBalance = await ethers.provider.getBalance(contract.address);

            const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

            let tx = await contract.emergencyWithdraw();
            let gasPrice = tx.gasPrice;
            tx = await tx.wait();
            let gasUsed = tx.gasUsed;

            const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
            expect(ownerBalanceAfter).to.be.equal(ownerBalanceBefore.add(contractBalance).sub(gasUsed.mul(gasPrice)));

            // Transfer ownership to bob
            await contract.transferOwnership(bob.address);

            await contract.connect(charlie).mint(10, {
                value: etherPrice(costPublicSale, 10),
            });

            contractBalance = await ethers.provider.getBalance(contract.address);

            const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

            tx = await contract.connect(bob).emergencyWithdraw();
            gasPrice = tx.gasPrice;
            tx = await tx.wait();
            gasUsed = tx.gasUsed;

            const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
            expect(bobBalanceAfter).to.be.equal(bobBalanceBefore.add(contractBalance).sub(gasUsed.mul(gasPrice)));
        });

        it("Only owner can call emergencyWithdraw", async () => {
            await contract.setOnlyPublicSale();
            await contract.connect(alice).mint(10, {
                value: etherPrice(costPublicSale, 10),
            });

            await expect(contract.connect(alice).emergencyWithdraw()).to.be.revertedWith("Ownable: caller is not the owner");

            await contract.emergencyWithdraw(); // this works
        });

        it("Only owner can call withdraw", async () => {
            await contract.setOnlyPublicSale();
            await contract.connect(alice).mint(10, {
                value: etherPrice(costPublicSale, 10),
            });

            await expect(contract.connect(alice).withdraw()).to.be.revertedWith("Ownable: caller is not the owner");

            await contract.withdraw(); // this works
        });
    });
});
