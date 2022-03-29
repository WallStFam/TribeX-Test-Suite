const fs = require("fs");
const { default: MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
require("dotenv").config();

function getContractAddress(contractName, network = "") {
    const config = getFrontendConfig(network);
    if (!config[contractName] || !config[contractName].contractAddress) {
        return null;
    }
    return config[contractName].contractAddress;
}

async function getDeployedContract(contractName, network = "") {
    if (network === "") {
        network = hre.network.name;
    }
    const contractAddress = getContractAddress(contractName, network);
    if (!contractAddress) {
        return null;
    }
    const contract = await hre.ethers.getContractAt(contractName, contractAddress);
    return contract;
}

async function getWallStMomsDeployedContract(network = "") {
    return await getDeployedContract("WallStMoms", network);
}

async function getWallStDadsDeployedContract(network = "") {
    return await getDeployedContract("WallStDads", network);
}

function getFrontendConfig(network = "") {
    if (network === "") {
        network = hre.network.name;
    }
    let config = {};
    const configPath = getFrontendConfigPath(hre.network.name);
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath));
    }
    return config;
}

function setFrontendConfig(config) {
    if (!fs.existsSync("frontend")) {
        fs.mkdirSync("frontend");
    }
    fs.writeFileSync(getFrontendConfigPath(hre.network.name), JSON.stringify(config, null, 4));
    if (process.env.FRONTEND_REPO_URL) {
        fs.writeFileSync(process.env.FRONTEND_REPO_URL + "/src/config.json", str);
    }
}

function getFrontendConfigPath(network = "") {
    if (network === "") {
        network = hre.network.name;
    }
    return "frontend/config-" + network + ".json";
}

function writeDeployedContract(contractName, address, writeAbi, network = "") {
    if (network === "") {
        network = hre.network.name;
    }
    const config = getFrontendConfig();
    if (!config[contractName]) {
        config[contractName] = {};
    }
    config[contractName].contractAddress = address;
    if (writeAbi) {
        config[contractName].abi = require(`../artifacts/contracts/${contractName}.sol/${contractName}.json`).abi;
    }
    setFrontendConfig(config);
}

function loadWhitelist(name = "") {
    let file = "whitelist" + name;
    if (hre.network.name == "localhost" || hre.network.name == "hardhat") {
        file += "-localhost.txt";
    } else {
        file += "-" + hre.network.name + ".txt";
    }
    const whitelist = fs
        .readFileSync("whitelists/" + file, "utf8")
        .split("\n")
        .map((addr) => addr.trim());

    if (whitelist.length === 1 && whitelist[0] === "") {
        // this edge case only happens if the whitelist is empty, it ends up with one empty element
        whitelist = []; // remove that empty element
    }

    return whitelist;
}

function loadWhitelistSF() {
    return loadWhitelist("SF");
}

function loadWhitelistMerkleTree(whitelistName = "") {
    var whitelist = loadWhitelist(whitelistName);
    return getMerkleTreeFromWhitelist(whitelist);
}

function getMerkleTreeFromWhitelist(whitelist) {
    const leafNodes = whitelist.map((addr) => keccak256(addr));
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    return merkleTree;
}

function getMerkleTreeFromWhitelistWithAmounts(whitelist) {
    const leafNodes = [];
    for (let i = 0; i < whitelist.length; i++) {
        let obj = whitelist[i];
        leafNodes.push(keccak256(addressPlusAmount(obj.address, obj.amount)));
    }
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    return merkleTree;
}

function loadWhitelistSFMerkleTree() {
    return loadWhitelistMerkleTree("SF");
}

function dec2hex(n) {
    return (n + 0x10000).toString(16).substr(-4);
}

function addressPlusAmount(address, amount) {
    const hex = dec2hex(amount);
    return address + hex;
}

function loadWhitelistWithAmountsMerkleTree(whitelistName = "") {
    var whitelistWithAmounts = loadWhitelistWithAmounts(whitelistName);
    const leafNodes = [];
    for (let i = 0; i < whitelistWithAmounts.length; i++) {
        let obj = whitelistWithAmounts[i];
        leafNodes.push(keccak256(addressPlusAmount(obj.address, obj.amount)));
    }
    const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });
    return merkleTree;
}

function loadWhitelistFreeMintMerkleTree() {
    return loadWhitelistWithAmountsMerkleTree("FreeMint");
}

function loadWhitelistWithAmounts(name = "") {
    let file = "whitelist" + name;
    if (hre.network.name == "localhost" || hre.network.name == "hardhat") {
        file += "-localhost.txt";
    } else {
        file += "-" + hre.network.name + ".txt";
    }
    const whitelistWithAmounts = fs
        .readFileSync("whitelists/" + file, "utf8")
        .split("\n")
        .map((line) => {
            const [address, amount] = line.split(" ");
            return { address: address.trim(), amount: parseInt(amount) };
        });

    if (whitelistWithAmounts.length === 1 && whitelistWithAmounts[0] === "") {
        // this edge case only happens if the whitelist is empty, it ends up with one empty element
        whitelistWithAmounts = []; // remove that empty element
    }

    return whitelistWithAmounts;
}

function loadWhitelistFreeMint() {
    return loadWhitelistWithAmounts("FreeMint");
}

function saveProcessedWhitelist(whitelistName, whitelistHashedAddresses, merkleRoot) {
    const config = getFrontendConfig();
    if (!config["whitelist" + whitelistName]) {
        config["whitelist" + whitelistName] = {};
    }
    config["whitelist" + whitelistName] = { merkleRoot, whitelistHashedAddresses };
    setFrontendConfig(config);
}

function writeEtherscanVerifyScript(contractAddress) {
    if (hre.network.name != "rinkeby" && hre.network.name != "mainnet") {
        return;
    }
    const packageJson = JSON.parse(fs.readFileSync("package.json"));
    packageJson.scripts["verify-" + hre.network.name] =
        "npx hardhat verify --network " +
        hre.network.name +
        " --constructor-args scripts/constructorArguments.js " +
        contractAddress;
    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 4));
}

async function writeMomsContractStateToFrontendConfig(contract) {
    const config = getFrontendConfig();
    if (!config["WallStMoms"]) {
        console.log("There's no deployed WallStMoms contract to " + hre.network.name + " network");
        return;
    }
    let state = {};
    state.maxMintAmountPublicSale = await contract.maxMintAmountPublicSale();
    state.maxMintAmountWhitelist = await contract.maxMintAmountWhitelist();
    state.maxMintAmountWhitelistSF = await contract.maxMintAmountWhitelistSF();
    state.maxSupply = await contract.maxSupply();
    state.costPublicSale = Number(ethers.utils.formatEther(await contract.costPublicSale()));
    state.costWhitelisted = Number(ethers.utils.formatEther(await contract.costWhitelisted()));
    state.costWhitelistedSF = Number(ethers.utils.formatEther(await contract.costWhitelistedSF()));

    config["WallStMoms"].state = state;

    setFrontendConfig(config);
}

function writeMintCostsToFrontendConfig(costPublicSale, costWhitelisted) {
    const config = getFrontendConfig();
    if (config["WallStMoms"].state == null) {
        config["WallStMoms"].state = {};
    }
    config["WallStMoms"].state.costPublicSale = costPublicSale;
    config["WallStMoms"].state.costWhitelisted = costWhitelisted;
    setFrontendConfig(config);
}

function shortAddress(address) {
    return address.slice(0, 10) + "...";
}

function getFreeMintAmount(address) {
    const whitelist = loadWhitelistFreeMint();
    return getFreeMintAmountFromWhitelist(address, whitelist);
}

function getFreeMintAmountFromWhitelist(address, whitelist) {
    for (let i = 0; i < whitelist.length; i++) {
        if (whitelist[i].address.toLowerCase() == address.toLowerCase()) {
            return whitelist[i].amount;
        }
    }
    return 0;
}

function getHexProof(whitelist, address) {
    const merkleTree = getMerkleTreeFromWhitelist(whitelist);
    const hash = keccak256(address.toLowerCase());
    const proof = merkleTree.getHexProof(hash);
    return proof;
}

function getHexProofWithAmount(whitelist, address, amount) {
    const merkleTree = getMerkleTreeFromWhitelistWithAmounts(whitelist);
    const hash = keccak256(addressPlusAmount(address.toLowerCase(), amount));
    const proof = merkleTree.getHexProof(hash);
    return proof;
}

module.exports = {
    getFrontendConfig,
    setFrontendConfig,
    writeDeployedContract,
    getContractAddress,
    getDeployedContract,
    getWallStMomsDeployedContract,
    getWallStDadsDeployedContract,
    loadWhitelist,
    loadWhitelistSF,
    loadWhitelistFreeMint,
    loadWhitelistMerkleTree,
    loadWhitelistSFMerkleTree,
    loadWhitelistFreeMintMerkleTree,
    loadWhitelistWithAmounts,
    loadWhitelistWithAmountsMerkleTree,
    loadWhitelistFreeMint,
    loadWhitelistFreeMintMerkleTree,
    saveProcessedWhitelist,
    writeEtherscanVerifyScript,
    writeMomsContractStateToFrontendConfig,
    writeMintCostsToFrontendConfig,
    shortAddress,
    addressPlusAmount,
    getFreeMintAmount,
    getMerkleTreeFromWhitelist,
    getMerkleTreeFromWhitelistWithAmounts,
    getHexProof,
    getHexProofWithAmount,
    getFreeMintAmountFromWhitelist,
};
