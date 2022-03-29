const { expect } = require("chai");
const { ethers } = require("hardhat");
require("dotenv").config();
const {
    getMerkleTreeFromWhitelist,
    getHexProof,
    getHexProofWithAmount,
    getMerkleTreeFromWhitelistWithAmounts,
    getFreeMintAmountFromWhitelist,
} = require("../scripts/utils");

function generateRandomAddresses(count) {
    let addrs = [];
    for (let i = 0; i < count; i++) {
        addrs.push(ethers.Wallet.createRandom().address);
    }
    return addrs;
}

// ger random int
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

describe("Empire", function () {
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
    let maxMintAmount;

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

        maxMintAmountWhitelistOG = (await contract.ADDRESS_OG_MAX_MINTS()).toNumber();
        maxMintAmountWhitelist = (await contract.ADDRESS_WL_MAX_MINTS()).toNumber();
        maxMintAmountPublicSale = (await contract.PUBLIC_MINT_PER_TX()).toNumber();
        maxMintAmount = (await contract.ADDRESS_MAX_MINTS()).toNumber();

        maxSupply = (await contract.maxSupply()).toNumber();

        costWhitelistedOG = ethers.utils.formatEther(await contract.OGprice());
        costWhitelisted = ethers.utils.formatEther(await contract.WLprice());
        costPublicSale = ethers.utils.formatEther(await contract.price());
    });

    describe("Deployment", () => {
        it("Should have set the right owner", async () => {
            expect(await contract.owner()).to.equal(owner.address);
        });

        it('Should have set name to "TRIBE-X-ACT-1"', async () => {
            expect(await contract.name()).to.equal("TRIBE-X-ACT-1");
        });

        it('Should have set symbol to "TRIBEX"', async () => {
            expect(await contract.symbol()).to.equal("TRIBEX");
        });

        it("MaxMintAmounts should be 3, 3, 12, 12 at initialization", async () => {
            expect(maxMintAmountPublicSale).to.equal(12);
            expect(maxMintAmountWhitelist).to.equal(3);
            expect(maxMintAmountWhitelistOG).to.equal(3);
            expect(maxMintAmount).to.equal(12);
        });
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
            await contract.connect(owner).toggleSaleOff();

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
            await contract.connect(alice).mintOGSale(maxMintAmount - 1, hexProof, {
                value: etherPrice(costWhitelistedOG, maxMintAmount - 1),
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

    describe.only("Whitelist", () => {
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
            await contract.connect(owner).toggleSaleOff();

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
            await contract.connect(alice).mintWLSale(maxMintAmount - 1, hexProof, {
                value: etherPrice(costWhitelisted, maxMintAmount - 1),
            });
            await expect(
                contract.connect(alice).mintWLSale(2, hexProof, {
                    value: etherPrice(costWhitelisted, 2),
                })
            ).to.be.revertedWith("Sender is trying to mint more than allocated tokens");
        });

        it("Cannot mint more than collection max supply", async () => {
            await contract.setOnlyWL();
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

    describe("Whitelist Free Mint", () => {
        it("Try many random addresses and check they are not whitelisted", async () => {
            const randomCount = 100;
            for (let i = 0; i < randomCount; i++) {
                const randomAddress = ethers.Wallet.createRandom().address;
                const amount = getRandomInt(10);
                hexProof = getHexProofWithAmount(whitelistFreeMint, randomAddress, amount);
                expect(hexProof.length).to.equal(0);
                expect(await contract.isWhitelistedForFreeMint(randomAddress, amount, hexProof)).to.equal(false);
            }
        });

        it("Should allow anyone check if address is whitelisted", async () => {
            const randomIndex = getRandomInt(whitelistFreeMint.length);
            const obj = whitelistFreeMint[randomIndex];
            hexProof = getHexProofWithAmount(whitelistFreeMint, obj.address, obj.amount);
            expect(await contract.connect(bob).isWhitelistedForFreeMint(obj.address, obj.amount, hexProof)).to.equal(true);
        });

        it("All whitelisted addresses are whitelisted", async () => {
            for (let i = 0; i < whitelistFreeMint.length; i++) {
                const obj = whitelistFreeMint[i];
                hexProof = getHexProofWithAmount(whitelistFreeMint, obj.address, obj.amount);
                expect(await contract.isWhitelistedForFreeMint(obj.address, obj.amount, hexProof)).to.equal(true);
            }
        });

        it("Only the owner can set a new whitelist", async () => {
            const newWhitelist = [{ address: bob.address, amount: 10 }];
            const newMerkleTree = getMerkleTreeFromWhitelistWithAmounts(newWhitelist);
            const newRootHashFreeMint = newMerkleTree.getRoot();
            await contract.setWhitelistForFreeMint(newRootHashFreeMint);
            const newRootHashHexFreeMint = "0x" + newRootHashFreeMint.toString("hex");
            expect(await contract.merkleRootFreeMint()).to.equal(newRootHashHexFreeMint);

            const randomAddress = ethers.Wallet.createRandom().address;
            await expect(contract.connect(randomAddress).setWhitelistForFreeMint(rootHashFreeMint)).to.be.reverted;
        });

        it("If setting a new whitelist, users that were whitelisted previously are not whitelisted anymore", async () => {
            const randomIndex = getRandomInt(whitelistFreeMint.length);
            const obj = whitelistFreeMint[randomIndex];
            hexProof = getHexProofWithAmount(whitelistFreeMint, obj.address, obj.amount);
            expect(await contract.isWhitelistedForFreeMint(obj.address, obj.amount, hexProof)).to.equal(true);

            const randomAddresses = generateRandomAddresses(10);
            const newWhitelist = randomAddresses.map((addr) => ({ address: addr, amount: getRandomInt(10) })); // create a new whitelist with only random addresses
            const newMerkleTree = getMerkleTreeFromWhitelistWithAmounts(newWhitelist);
            const newRootHash = newMerkleTree.getRoot();
            await contract.setWhitelistForFreeMint(newRootHash);

            hexProof = getHexProofWithAmount(newWhitelist, obj.address, obj.amount);
            expect(hexProof.length).to.equal(0);
            expect(await contract.isWhitelistedForFreeMint(obj.address, obj.amount, hexProof)).to.equal(false);
        });

        it("If setting a new whitelist, the new users in the whitelist are effectively whitelisted", async () => {
            // Generate a list of random addresses(because they are random, these addresses
            // are not in the original whitelist)
            const randomAddrs = generateRandomAddresses(10);
            const newWhitelist = randomAddrs.map((addr) => ({ address: addr, amount: getRandomInt(10) })); // create a new whitelist with only random addresses

            // Confirm that these addresses are not in the contract whitelist
            for (let i = 0; i < newWhitelist.length; i++) {
                const addr = newWhitelist[i].address;
                const amount = newWhitelist[i].amount;
                hexProof = getHexProofWithAmount(newWhitelist, addr, amount);
                expect(await contract.isWhitelistedForFreeMint(addr, amount, hexProof)).to.equal(false);
            }

            const newMerkleTree = getMerkleTreeFromWhitelistWithAmounts(newWhitelist);
            await contract.setWhitelistForFreeMint(newMerkleTree.getRoot());

            // Since none of the random addresses that were originally whitelisted(the ones created in
            // scripts/saveWhitelist.js) are whitelisted anymore we can also check that
            for (let i = 0; i < randomAddrs.length; i++) {
                const addr = newWhitelist[i].address;
                const amount = newWhitelist[i].amount;
                hexProof = getHexProofWithAmount(newWhitelist, addr, amount);
                expect(await contract.isWhitelistedForFreeMint(addr, amount, hexProof)).to.equal(true);
            }
        });

        it("A non whitelisted user with a correct hexProof is not whitelisted", async () => {
            const randomAddress = ethers.Wallet.createRandom().address;
            const obj = whitelistFreeMint[getRandomInt(whitelistFreeMint.length)];
            hexProof = getHexProofWithAmount(whitelistFreeMint, obj.address, obj.amount);
            expect(hexProof.length).to.be.greaterThan(0);
            expect(await contract.isWhitelisted(randomAddress, hexProof)).to.equal(false);
        });

        it("A whitelisted user with an incorrect hexProof is not whitelisted", async () => {
            const randomAddress = ethers.Wallet.createRandom().address;
            const randomAmount = getRandomInt(10);
            hexProof = getHexProofWithAmount(whitelistFreeMint, randomAddress, randomAmount);
            expect(hexProof.length).to.be.eq(0);

            const obj = whitelistFreeMint[getRandomInt(whitelistFreeMint.length)];
            expect(await contract.isWhitelistedForFreeMint(obj.address, obj.amount, hexProof)).to.equal(false);
        });

        it("A whitelisted user can only mint once using dads", async () => {
            await contract.setWhitelistFreeMintSale();
            const amount = getFreeMintAmountFromWhitelist(dennis.address, whitelistFreeMint);
            expect(amount).to.be.greaterThan(0);
            hexProof = getHexProofWithAmount(whitelistFreeMint, dennis.address, amount);
            expect(hexProof.length).to.be.greaterThan(0);
            await contract.connect(dennis).mintFreeWithDads(amount, hexProof);
            expect(await contract.balanceOf(dennis.address)).to.eq(amount);
            await expect(contract.connect(dennis).mintFreeWithDads(amount, hexProof)).to.be.revertedWith(
                "You already minted your free moms"
            );
        });

        it("A whitelisted user can only mint the exact amount of 0g dads he minted", async () => {
            await contract.setWhitelistFreeMintSale();
            const amount = getFreeMintAmountFromWhitelist(dennis.address, whitelistFreeMint);
            expect(amount).to.be.greaterThan(0);
            hexProof = getHexProofWithAmount(whitelistFreeMint, dennis.address, amount);
            expect(hexProof.length).to.be.greaterThan(0);
            await expect(contract.connect(dennis).mintFreeWithDads(amount - 1, hexProof)).to.be.revertedWith(
                "You are not whitelisted or the amount doesn't match"
            );
            await expect(contract.connect(dennis).mintFreeWithDads(amount + 1, hexProof)).to.be.revertedWith(
                "You are not whitelisted or the amount doesn't match"
            );
            await contract.connect(dennis).mintFreeWithDads(amount, hexProof);
        });

        it("A whitelisted user can only mint if the phase is active", async () => {
            const amount = getFreeMintAmountFromWhitelist(dennis.address, whitelistFreeMint);
            expect(amount).to.be.greaterThan(0);
            hexProof = getHexProofWithAmount(whitelistFreeMint, dennis.address, amount);
            expect(hexProof.length).to.be.greaterThan(0);
            await expect(contract.connect(dennis).mintFreeWithDads(amount, hexProof)).to.be.revertedWith(
                "Whitelist Free Mint sale is not active"
            );

            await contract.setWhitelistFreeMintSale();
            await contract.connect(dennis).mintFreeWithDads(amount, hexProof);
        });

        it("Should fail if minting is paused", async () => {
            await contract.connect(owner).setPaused(true);

            await contract.setWhitelistFreeMintSale();
            const amount = getFreeMintAmountFromWhitelist(dennis.address, whitelistFreeMint);
            expect(amount).to.be.greaterThan(0);
            hexProof = getHexProofWithAmount(whitelistFreeMint, dennis.address, amount);
            expect(hexProof.length).to.be.greaterThan(0);
            await expect(contract.connect(dennis).mintFreeWithDads(amount, hexProof)).to.be.revertedWith(
                "Please wait until unpaused"
            );
        });

        it("Should succeed if minting is unpaused", async () => {
            await contract.connect(owner).setPaused(false);

            await contract.setWhitelistFreeMintSale();
            const amount = getFreeMintAmountFromWhitelist(dennis.address, whitelistFreeMint);
            expect(amount).to.be.greaterThan(0);
            hexProof = getHexProofWithAmount(whitelistFreeMint, dennis.address, amount);
            expect(hexProof.length).to.be.greaterThan(0);
            await contract.connect(dennis).mintFreeWithDads(amount, hexProof);
            expect(await contract.balanceOf(dennis.address)).to.eq(amount);
        });
    });

    describe("Public Sale", () => {
        it("Should fail if minting is paused", async () => {
            await contract.connect(owner).setPaused(true);

            await contract.setPublicSale();
            await expect(contract.connect(charlie).mintPublicSale(1, { value: etherPrice(costPublicSale) })).to.be.revertedWith(
                "Please wait until unpaused"
            );
        });

        it("Should succeed if minting is unpaused", async () => {
            await contract.connect(owner).setPaused(false);

            await contract.setPublicSale();
            await contract.connect(charlie).mintPublicSale(1, { value: etherPrice(costPublicSale) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        it("Should fail if payed value is low", async () => {
            await contract.setPublicSale();
            await expect(
                contract.connect(charlie).mintPublicSale(1, { value: etherPrice(costPublicSale * 0.9) })
            ).to.be.revertedWith("Insufficient ETH amount");
        });

        it("Users cannot mint more than max amount", async () => {
            await contract.setPublicSale();
            await expect(
                contract.connect(alice).mintPublicSale(maxMintAmountPublicSale + 1, {
                    value: etherPrice(costPublicSale, maxMintAmountPublicSale + 1),
                })
            ).to.be.revertedWith("Max mint amount exceeded");
        });
    });

    describe("White Yeti mint", () => {
        it("A White Yeti address can mint up to 'maxMintAmountWhiteYeti'", async () => {
            const maxMintAmount = await contract.maxMintAmountWhiteYeti();
            await expect(
                contract
                    .connect(yetiOwner1)
                    .mintWithWhiteYeti(maxMintAmount + 1, { value: etherPrice(costWhitelisted * (maxMintAmount + 1)) })
            ).to.be.revertedWith("Max mint amount exceeded");

            await contract
                .connect(yetiOwner1)
                .mintWithWhiteYeti(maxMintAmount, { value: etherPrice(costWhitelisted * maxMintAmount) });
            expect(await contract.balanceOf(yetiOwner1.address)).to.equal(maxMintAmount);
        });

        it("Only owner can add White Yeti addresses", async () => {
            await expect(contract.connect(alice).addWhiteYetiAddresses([alice.address])).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await contract.addWhiteYetiAddresses([alice.address]);
        });

        it("A White Yeti address can mint with WhiteYeti only once", async () => {
            await contract.connect(yetiOwner1).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted) });
            expect(await contract.balanceOf(yetiOwner1.address)).to.equal(1);
            await expect(
                contract.connect(yetiOwner1).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted) })
            ).to.be.revertedWith("You already minted");
        });

        it("WhiteYeti mint costs the same as whitelist mint", async () => {
            const maxMintAmount = await contract.maxMintAmountWhiteYeti();
            const cost = await contract.costWhitelisted();
            await expect(
                contract.connect(yetiOwner1).mintWithWhiteYeti(maxMintAmount, { value: cost.mul(maxMintAmount).sub(1) })
            ).to.be.revertedWith("Insufficient ETH amount");
            await contract.connect(yetiOwner1).mintWithWhiteYeti(maxMintAmount, { value: cost.mul(maxMintAmount) });
            expect(await contract.balanceOf(yetiOwner1.address)).to.equal(maxMintAmount);
        });

        it("MaxMintAmountWhiteYeti is initialized in 100", async () => {
            expect(await contract.maxMintAmountWhiteYeti()).to.be.equal(100);
        });

        it("Should fail if minting is paused", async () => {
            await contract.connect(owner).setPaused(true);

            await expect(
                contract.connect(yetiOwner1).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted) })
            ).to.be.revertedWith("Please wait until unpaused");
        });

        it("Should succeed if minting is unpaused", async () => {
            await contract.connect(owner).setPaused(false);

            await contract.connect(yetiOwner1).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted) });
            expect(await contract.balanceOf(yetiOwner1.address)).to.equal(1);
        });

        it("Should fail if payed value is low", async () => {
            await expect(
                contract.connect(yetiOwner1).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted * 0.9) })
            ).to.be.revertedWith("Insufficient ETH amount");
        });

        it("Only owner can add new white yeti addresses", async () => {
            await expect(contract.connect(alice).addWhiteYetiAddresses([alice.address])).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await contract.addWhiteYetiAddresses([alice.address]);
        });

        it("A new white yeti address can then mint up to 'maxMintAmountWhiteYeti'", async () => {
            await contract.addWhiteYetiAddresses([alice.address]);
            const maxMintAmount = await contract.maxMintAmountWhiteYeti();
            await expect(
                contract
                    .connect(alice)
                    .mintWithWhiteYeti(maxMintAmount + 1, { value: etherPrice(costWhitelisted * (maxMintAmount + 1)) })
            ).to.be.revertedWith("Max mint amount exceeded");
            await contract
                .connect(alice)
                .mintWithWhiteYeti(maxMintAmount, { value: etherPrice(costWhitelisted * maxMintAmount) });
        });

        it("A non white yeti owner cannot mint", async () => {
            await expect(
                contract.connect(alice).mintWithWhiteYeti(1, { value: etherPrice(costWhitelisted * 1) })
            ).to.be.revertedWith("You don't have white yeti badge");
        });
    });

    describe("Minting", () => {
        it("Should fail if mint amount is less than 1", async () => {
            await contract.setPublicSale();
            await expect(contract.connect(alice).mintPublicSale(0)).to.be.revertedWith("Need to mint more than 0");
        });

        it("Should be able to mint if value is equal to the required amount", async () => {
            // check for all mint types
            await contract.setWhitelistSFSale();
            hexProof = getHexProof(whitelistOG, bob.address);
            await contract.connect(bob).mintWhitelistedSF(1, hexProof, { value: etherPrice(costWhitelistedOG) });
            expect(await contract.balanceOf(bob.address)).to.equal(1);

            await contract.setWhitelistSale();
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWhitelisted_phase1(1, hexProof, { value: etherPrice(costWhitelisted) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);

            await contract.setPublicSale();
            await contract.connect(charlie).mintPublicSale(1, { value: etherPrice(costPublicSale) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        it("Should be able to mint if value is more than the required amount", async () => {
            // check for all mint types
            await contract.setWhitelistSFSale();
            hexProof = getHexProof(whitelistOG, bob.address);
            await contract.connect(bob).mintWhitelistedSF(1, hexProof, { value: etherPrice(costWhitelistedOG + 1) });
            expect(await contract.balanceOf(bob.address)).to.equal(1);

            await contract.setWhitelistSale();
            hexProof = getHexProof(whitelist, alice.address);
            await contract.connect(alice).mintWhitelisted_phase1(1, hexProof, { value: etherPrice(costWhitelisted + 1) });
            expect(await contract.balanceOf(alice.address)).to.equal(1);

            await contract.setPublicSale();
            await contract.connect(charlie).mintPublicSale(1, { value: etherPrice(costPublicSale + 1) });
            expect(await contract.balanceOf(charlie.address)).to.equal(1);
        });

        /* 
        TBD: This test only makes sense if maxSupply is fixed
        it("Should fail if total supply of tokens reaches the max amount", async () => {
			await moms.setPublicSale();
			const maxSupply = await moms.maxSupply();
			await moms.setPhaseMaxSupply(1, 50000); // more than the max supply
			await moms.setPhase(1);
			await moms.setMaxMintAmountPublicSale(20000);
			for (let i = 0; i < maxSupply / 50 - 1; i++) {
				await moms.connect(alice).mintPublicSale(50, {
					value: etherPrice(costPublicSale, 50),
				});
			}

			await expect(
				moms.connect(alice).mintPublicSale(55, {
					value: etherPrice(costPublicSale, 55),
				})
			).to.be.revertedWith("Not enough NFTs left to mint that many!");
		});*/

        it("Users cannot mint more than max amount", async () => {
            await contract.setWhitelistSFSale();
            hexProof = getHexProof(whitelistOG, bob.address);
            await expect(
                contract.connect(bob).mintWhitelistedSF(2, hexProof, {
                    value: etherPrice(costPublicSale, maxMintAmountWhitelistOG + 1),
                })
            ).to.be.revertedWith("Max mint amount exceeded");

            await contract.setWhitelistSale();
            hexProof = getHexProof(whitelist, alice.address);
            await expect(
                contract.connect(alice).mintWhitelisted_phase1(maxMintAmountWhitelist + 1, hexProof, {
                    value: etherPrice(costPublicSale, maxMintAmountWhitelist + 1),
                })
            ).to.be.revertedWith("Max mint amount exceeded");

            await contract.setPublicSale();
            await expect(
                contract.connect(alice).mintPublicSale(maxMintAmountPublicSale + 1, {
                    value: etherPrice(costPublicSale, maxMintAmountPublicSale + 1),
                })
            ).to.be.revertedWith("Max mint amount exceeded");
        });

        it("mintOnlyOwner can only be called by owner", async () => {
            await contract.connect(owner).mintOnlyOwner(1, { value: etherPrice(costPublicSale) });
            expect(await contract.balanceOf(owner.address)).to.be.equal(1);
            await expect(contract.connect(alice).mintOnlyOwner(1, { value: etherPrice(costPublicSale) })).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });

        it("totalSupply should be equal to the amount of mints minus the amount of burns", async () => {
            const totalSupply = await contract.totalSupply();
            expect(totalSupply).to.be.equal(0);
            await contract.setPublicSale();
            await contract.connect(alice).mintPublicSale(1, { value: etherPrice(costPublicSale) });
            expect(await contract.totalSupply()).to.be.equal(1);
            await contract.connect(alice).mintPublicSale(1, { value: etherPrice(costPublicSale) });
            expect(await contract.totalSupply()).to.be.equal(2);

            await contract.connect(alice).burn(1);
            expect(await contract.totalSupply()).to.be.equal(1);
        });

        it("Only owner can set minting costs", async () => {
            const newPublicSaleCost = costPublicSale * 2;
            const newWhitelistedCost = costWhitelisted * 2;
            const newWhitelistedSFCost = costWhitelistedOG * 2;

            await expect(contract.connect(alice).setCostWhitelistedSF(etherPrice(newWhitelistedSFCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setCostWhitelisted(etherPrice(newWhitelistedCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setCostPublicSale(etherPrice(newPublicSaleCost))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );

            await contract.connect(owner).setCostWhitelistedSF(etherPrice(newWhitelistedSFCost));
            await contract.connect(owner).setCostWhitelisted(etherPrice(newWhitelistedCost));
            await contract.connect(owner).setCostPublicSale(etherPrice(newPublicSaleCost));

            expect(await contract.costWhitelistedSF()).to.be.equal(etherPrice(newWhitelistedSFCost));
            expect(await contract.costWhitelisted()).to.be.equal(etherPrice(newWhitelistedCost));
            expect(await contract.costPublicSale()).to.be.equal(etherPrice(newPublicSaleCost));
        });

        it("Only owner can set max mint amounts", async () => {
            const newmaxMintAmountWhitelistSF = maxMintAmountWhitelistOG * 2;
            const newMaxMintAmountWhitelist = maxMintAmountWhitelist * 2;
            const newMaxMintAmount = maxMintAmountPublicSale * 2;

            await expect(contract.connect(alice).setMaxMintAmountWhitelistSF(newmaxMintAmountWhitelistSF)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setMaxMintAmountWhitelist(newMaxMintAmountWhitelist)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setMaxMintAmountPublicSale(newMaxMintAmount)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );

            await contract.connect(owner).setMaxMintAmountWhitelistSF(newmaxMintAmountWhitelistSF);
            await contract.connect(owner).setMaxMintAmountWhitelist(newMaxMintAmountWhitelist);
            await contract.connect(owner).setMaxMintAmountPublicSale(newMaxMintAmount);

            expect(await contract.maxMintAmountWhitelistSF()).to.be.equal(newmaxMintAmountWhitelistSF);
            expect(await contract.maxMintAmountWhitelist()).to.be.equal(newMaxMintAmountWhitelist);
            expect(await contract.maxMintAmountPublicSale()).to.be.equal(newMaxMintAmount);
        });

        it("If SF user minted and then sends the token to another address, he cannot mint again", async () => {
            await contract.setWhitelistSFSale();
            hexProof = getHexProof(whitelistOG, bob.address);

            await contract.connect(bob).mintWhitelistedSF(1, hexProof, { value: etherPrice(costWhitelistedOG) });
            expect(await contract.balanceOf(bob.address)).to.equal(1);

            await network.provider.send("evm_increaseTime", [await contract.blockTransferSecondsSF()]);
            await network.provider.send("evm_mine");

            await contract.connect(bob).transferFrom(bob.address, alice.address, 1);
            expect(await contract.balanceOf(bob.address)).to.equal(0);

            await expect(
                contract.connect(bob).mintWhitelistedSF(1, hexProof, { value: etherPrice(costWhitelistedOG) })
            ).to.be.revertedWith("You already minted");
        });
    });

    describe("Phases", () => {
        it("getPhaseForTokenId returns the correct phase", async () => {
            await contract.setPhaseMaxSupply(1, 10); // phase 1, tokens from 1 to 10
            await contract.setPhaseMaxSupply(2, 10); // phase 2, tokens from 11 to 20, // phase 3, tokens from 21 to 10000

            for (let i = 1; i <= 10; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(1);
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(2);
            }
            for (let i = 21; i <= 9999; i += 1000) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(3);
            }
        });

        it("Changing the phases max supply changes the phase for the tokens too", async () => {
            await contract.setPhaseMaxSupply(1, 10); // phase 1, tokens from 1 to 10
            await contract.setPhaseMaxSupply(2, 10); // phase 2, tokens from 11 to 20, // phase 3, tokens from 21 to 10000

            for (let i = 1; i <= 10; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(1);
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(2);
            }
            for (let i = 21; i <= 9999; i += 1000) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(3);
            }

            await contract.setPhaseMaxSupply(1, 5);
            await contract.setPhaseMaxSupply(2, 5);

            for (let i = 1; i <= 5; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(1);
            }
            for (let i = 6; i <= 10; i++) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(2);
            }
            for (let i = 11; i <= 9999; i += 1000) {
                expect(await contract.getPhaseForTokenId(i)).to.equal(3);
            }
        });

        it("Changing the phases max supply changes the token URIs too", async () => {
            await contract.setPublicSale();

            await contract.setPhaseMaxSupply(1, 10); // phase 0, tokens from 1 to 10
            await contract.setPhaseMaxSupply(2, 10); // phase 1, tokens from 11 to 20, // phase 2, tokens from 21 to 9999

            await contract.setPhase(3);
            await contract.setMaxMintAmountPublicSale(100); // set max mint amount after changing the phase

            await contract.mintPublicSale(50, { value: etherPrice(costPublicSale, 50) });

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }
            for (let i = 21; i <= 50; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }

            await contract.revealPhase1(baseURI);

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }
            for (let i = 21; i <= 50; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }

            await contract.revealPhase2(baseURI_2);

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI_2 + i + ".json");
            }
            for (let i = 21; i <= 50; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }

            await contract.revealPhase3(baseURI_3);

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI_2 + i + ".json");
            }
            for (let i = 21; i <= 50; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI_3 + i + ".json");
            }
        });

        it("maxMintAmountWhitelistSF is 1 for all phases", async () => {
            await expect(await contract.maxMintAmountWhitelistSF()).to.be.equal(1);
            await contract.setPhase(2);
            await expect(await contract.maxMintAmountWhitelistSF()).to.be.equal(1);
            await contract.setPhase(3);
            await expect(await contract.maxMintAmountWhitelistSF()).to.be.equal(1);
        });

        it("Users can mint at most 'maxMintAmountWhitelist' in each whitelist phase", async () => {
            await contract.setWhitelistSale();

            const maxMintAmount = await contract.maxMintAmountWhitelist();
            await contract.setPhase(2);
            hexProof = getHexProof(whitelist, alice.address);
            await contract
                .connect(alice)
                .mintWhitelisted_phase2(maxMintAmount, hexProof, { value: etherPrice(costWhitelisted, maxMintAmount) });
            await expect(
                contract.connect(alice).mintWhitelisted_phase2(1, hexProof, { value: etherPrice(costWhitelisted, 1) })
            ).to.be.revertedWith("Max mint amount exceeded");

            await contract.setPhase(3);
            await contract
                .connect(alice)
                .mintWhitelisted_phase3(maxMintAmount, hexProof, { value: etherPrice(costWhitelisted, maxMintAmount) });
            await expect(
                contract.connect(alice).mintWhitelisted_phase3(1, hexProof, { value: etherPrice(costWhitelisted, 1) })
            ).to.be.revertedWith("Max mint amount exceeded");
        });

        it("Users can mint as many as they want in public sale but only 'maxMintAmount' at a time", async () => {
            await contract.setPublicSale();

            const maxMintAmount = await contract.maxMintAmountPublicSale();
            await expect(
                contract
                    .connect(alice)
                    .mintPublicSale(maxMintAmount + 1, { value: etherPrice(costPublicSale, maxMintAmount + 1) })
            ).to.be.revertedWith("Max mint amount exceeded");
            await contract.connect(alice).mintPublicSale(1, { value: etherPrice(costPublicSale, 1) });
            await contract.connect(alice).mintPublicSale(2, { value: etherPrice(costPublicSale, 2) });
            await contract.connect(alice).mintPublicSale(maxMintAmount, { value: etherPrice(costPublicSale, maxMintAmount) });
            await expect(
                contract
                    .connect(alice)
                    .mintPublicSale(maxMintAmount + 1, { value: etherPrice(costPublicSale, maxMintAmount + 1) })
            ).to.be.revertedWith("Max mint amount exceeded");
            await contract.connect(alice).mintPublicSale(2, { value: etherPrice(costPublicSale, 2) });
            await contract.setPhase(1);
            await contract.connect(alice).mintPublicSale(2, { value: etherPrice(costPublicSale, 2) });
            await contract.connect(alice).mintPublicSale(1, { value: etherPrice(costPublicSale, 1) });
            await contract.connect(alice).mintPublicSale(maxMintAmount, { value: etherPrice(costPublicSale, maxMintAmount) });
            await expect(
                contract
                    .connect(alice)
                    .mintPublicSale(maxMintAmount + 1, { value: etherPrice(costPublicSale, maxMintAmount + 1) })
            ).to.be.revertedWith("Max mint amount exceeded");
            await contract.setPhase(2);
            await contract.connect(alice).mintPublicSale(2, { value: etherPrice(costPublicSale, 2) });
            await contract.connect(alice).mintPublicSale(maxMintAmount, { value: etherPrice(costPublicSale, maxMintAmount) });
            await expect(
                contract
                    .connect(alice)
                    .mintPublicSale(maxMintAmount + 1, { value: etherPrice(costPublicSale, maxMintAmount + 1) })
            ).to.be.revertedWith("Max mint amount exceeded");
            await contract.connect(alice).mintPublicSale(2, { value: etherPrice(costPublicSale, 2) });
        });

        it("Can only freeze maxSupply if phase is 3", async () => {
            await expect(contract.freezeMaxSupply()).to.be.revertedWith("Phase is not 3");
            await contract.setPhase(2);
            await expect(contract.freezeMaxSupply()).to.be.revertedWith("Phase is not 3");
            await contract.setPhase(3);
            await contract.freezeMaxSupply();
        });

        it("Only owner can freeze max supply", async () => {
            await contract.setPhase(3);
            await expect(contract.connect(alice).freezeMaxSupply()).to.be.revertedWith("Ownable: caller is not the owner");
            await contract.freezeMaxSupply();
        });
    });

    describe("Metadata", () => {
        it("Tokens have the correct metadata URI", async () => {
            await contract.setPublicSale();

            await contract.setPhaseMaxSupply(1, 10); // phase 0, tokens from 1 to 10
            await contract.setMaxMintAmountPublicSale(100);
            await contract.mintPublicSale(5, { value: etherPrice(costPublicSale, 5) });

            for (let i = 1; i <= 5; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }

            await contract.revealPhase1(baseURI);

            for (let i = 1; i <= 5; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }

            await contract.setPhase(2);
            await contract.setPhaseMaxSupply(2, 10); // phase 1, tokens from 11 to 20, // phase 2, tokens from 21 to 9999
            await contract.setMaxMintAmountPublicSale(100);
            await contract.mintPublicSale(10, { value: etherPrice(costPublicSale, 10) });

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }
            for (let i = 11; i <= 15; i++) {
                expect(await contract.tokenURI(i)).to.equal(initNotRevealedURI);
            }
            await contract.revealPhase2(baseURI_2);

            await contract.setPhase(3);
            await contract.setMaxMintAmountPublicSale(100);
            await contract.revealPhase3(baseURI_3);
            await contract.mintPublicSale(40, { value: etherPrice(costPublicSale, 40) });

            for (let i = 1; i <= 10; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI + i + ".json");
            }
            for (let i = 11; i <= 20; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI_2 + i + ".json");
            }
            for (let i = 21; i <= 40; i++) {
                expect(await contract.tokenURI(i)).to.equal(baseURI_3 + i + ".json");
            }
        });

        it("Only owner can set baseURI", async () => {
            await expect(contract.connect(bob).setNotRevealedURI(initNotRevealedURI)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
            await expect(contract.connect(alice).setBaseURI(baseURI, 0)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(contract.connect(bob).setBaseURI(baseURI_2, 0)).to.be.revertedWith("Ownable: caller is not the owner");
            await expect(contract.connect(alice).setBaseURI(baseURI_3, 0)).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Only owner can set provenance hash", async () => {
            await expect(contract.connect(bob).setProvenanceHash(provenance)).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );

            await contract.connect(owner).setProvenanceHash(provenance);
            expect(await contract.PROVENANCE()).to.be.equal(provenance);
        });

        it("Only owner can freeze metadata", async () => {
            await contract.revealPhase1(baseURI);
            await contract.revealPhase2(baseURI_2);
            await contract.revealPhase3(baseURI_3);
            await contract.setPhase(3);
            await expect(contract.connect(bob).freezeMetadata()).to.be.revertedWith("Ownable: caller is not the owner");

            await contract.connect(owner).freezeMetadata();
            expect(await contract.frozenMetadata()).to.be.true;
        });

        it("If metadata is frozen, baseURI cannot change anymore", async () => {
            await contract.revealPhase1(baseURI);
            await contract.revealPhase2(baseURI_2);
            await contract.revealPhase3(baseURI_3);
            await contract.setPhase(3);
            await contract.connect(owner).freezeMetadata();
            await expect(contract.connect(owner).setBaseURI(baseURI, 0)).to.be.revertedWith("Metadata is frozen");

            await contract.unreveal();

            let uri = await contract.baseURI_1();
            await expect(contract.setBaseURI("randomURI", 1)).to.be.revertedWith("Metadata is frozen");
            await contract.revealPhase1("randomURI");
            expect(await contract.baseURI_1()).to.be.equal(uri);

            uri = await contract.baseURI_2();
            await expect(contract.setBaseURI("randomURI", 2)).to.be.revertedWith("Metadata is frozen");
            await contract.revealPhase2("randomURI");
            expect(await contract.baseURI_2()).to.be.equal(uri);

            uri = await contract.baseURI_3();
            await expect(contract.setBaseURI("randomURI", 3)).to.be.revertedWith("Metadata is frozen");
            await contract.revealPhase3("randomURI");
            expect(await contract.baseURI_3()).to.be.equal(uri);
        });

        it("Revealing the phase changes the baseURI", async () => {
            await contract.revealPhase1("randomURI_1");
            expect(await contract.baseURI_1()).to.be.equal("randomURI_1");

            await contract.revealPhase2("randomURI_2");
            expect(await contract.baseURI_2()).to.be.equal("randomURI_2");

            await contract.revealPhase3("randomURI_3");
            expect(await contract.baseURI_3()).to.be.equal("randomURI_3");
        });

        it("It is possible to reset the reveal", async () => {
            await contract.setPublicSale();

            await contract.connect(alice).mintPublicSale(3, { value: etherPrice(costPublicSale, 3) });

            await contract.setPhaseMaxSupply(1, 1);
            await contract.setPhaseMaxSupply(2, 1);

            await contract.revealPhase1(baseURI);
            expect(await contract.tokenURI(1)).to.equal(baseURI + 1 + ".json");
            await contract.unreveal();
            expect(await contract.tokenURI(1)).to.equal(initNotRevealedURI);

            await contract.revealPhase1(baseURI);
            await contract.revealPhase2(baseURI_2);
            expect(await contract.tokenURI(2)).to.equal(baseURI_2 + 2 + ".json");
            await contract.unreveal();
            expect(await contract.tokenURI(2)).to.equal(initNotRevealedURI);

            await contract.revealPhase1(baseURI);
            await contract.revealPhase2(baseURI_2);
            await contract.revealPhase3(baseURI_3);
            expect(await contract.tokenURI(3)).to.equal(baseURI_3 + 3 + ".json");
            await contract.unreveal();
            expect(await contract.tokenURI(3)).to.equal(initNotRevealedURI);
        });

        it("Can only reveal in order", async () => {
            await expect(contract.revealPhase2(baseURI_2)).to.be.revertedWith("Cannot reveal this phase");
            await expect(contract.revealPhase3(baseURI_3)).to.be.revertedWith("Cannot reveal this phase");
            contract.revealPhase1(baseURI);
            await expect(contract.revealPhase1(baseURI)).to.be.revertedWith("Cannot reveal this phase");
            await expect(contract.revealPhase3(baseURI_3)).to.be.revertedWith("Cannot reveal this phase");
            contract.revealPhase2(baseURI_2);
            await expect(contract.revealPhase1(baseURI)).to.be.revertedWith("Cannot reveal this phase");
            await expect(contract.revealPhase2(baseURI_2)).to.be.revertedWith("Cannot reveal this phase");
            contract.revealPhase3(baseURI_3);
        });

        it("Can mint as many as max supply is set", async () => {
            await contract.setPublicSale();
            let total = 20000;
            await contract.setMaxMintAmountPublicSale(total);
            await contract.setPhaseMaxSupply(1, total);
            for (let i = 0; i < 100; i++) {
                const amount = total / 100;
                await contract.connect(alice).mintPublicSale(amount, { value: etherPrice(costPublicSale, amount) });
            }

            expect(await contract.totalSupply()).to.eq(total);
        });
    });

    describe("Withdraw", async () => {
        it("Withdrawing should send 100% to phu", async () => {
            await contract.setPublicSale();

            await contract.setPhaseMaxSupply(1, 500);
            await contract.setMaxMintAmountPublicSale(100);
            await contract.connect(alice).mintPublicSale(50, {
                value: etherPrice(costPublicSale, 50),
            });

            const contractBalance = await ethers.provider.getBalance(contract.address);
            await contract.withdraw();

            const phuBalance = await ethers.provider.getBalance(aa);

            expect(phuBalance).to.be.equal(contractBalance);
        });
    });
});

/* Missing tests
    SafeTransferFrom is not working(it says the function doesn't exist)
*/

/* TODO

- Check how it works with OpenSea when we are limiting approveForAll and transfer
- Maybe reduce the error messages
- Add the marketing guy(10%) to the withdraw function
- (TBD) Wait for Phu to give me other people for the withdraw function
- (Low priority) Add Nico and me to the withdraw
- Check all tests one by one
*/
