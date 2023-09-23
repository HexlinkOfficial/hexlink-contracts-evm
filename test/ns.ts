import { expect } from "chai";
import { deployments } from "hardhat";
import * as hre from "hardhat";
import { hash } from "../tasks/utils";
import {
    NamespaceRegistry__factory,
    EnsRegistryProxy__factory,
    NamespaceRegistry,
    EnsRegistryProxy
} from "../typechain-types/";

describe("Hexlink", function() {
  let namespaceRegistry: NamespaceRegistry;
  let ensRegistryProxy: EnsRegistryProxy;
  let deployer: any; // HardhatEthersSigner
  let tester: any; // HardhatEthersSigner

  beforeEach(async function() {
    await deployments.fixture(["NS"]);
    const signers = await hre.ethers.getNamedSigners();
    deployer = signers.deployer;
    tester = signers.tester;
    namespaceRegistry = NamespaceRegistry__factory.connect(
        (await deployments.get("NamespaceRegistry")).address,
        hre.ethers.provider,
    );
    ensRegistryProxy = EnsRegistryProxy__factory.connect(
        (await deployments.get("EnsRegistryProxy")).address,
        hre.ethers.provider,
    );
  });

  it("should test namespace setter/getter", async function() {
    const ns = hash("eth");
    const ensRegistryAddr = await ensRegistryProxy.getAddress();
    expect(await namespaceRegistry.owner()).to.eq(deployer.address);
    // only deployer has permission to register new namespace
    await expect(
        namespaceRegistry.connect(tester).setNamespace(
            ns,
            tester.address,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(tester).setOwner(
            ns,
            tester.address
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(tester).setRegistry(
            ns,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );

    expect(await namespaceRegistry.getOwner(ns)).to.eq(
        hre.ethers.ZeroAddress
    );
    expect(await namespaceRegistry.getRegistry(ns)).to.eq(
        hre.ethers.ZeroAddress
    );

    // register eth namespace with tester as owner
    await expect(
        namespaceRegistry.connect(deployer).setNamespace(
            ns,
            tester.address,
            ensRegistryAddr,
        )
    ).to.emit(namespaceRegistry, "NewOwner").withArgs(ns, tester.address)
        .to.emit(namespaceRegistry, "NewRegistry")
        .withArgs(ns, ensRegistryAddr);

    expect(await namespaceRegistry.getOwner(ns))
        .to.eq(tester.address);
    expect(await namespaceRegistry.getRegistry(ns))
        .to.eq(ensRegistryAddr);

    // deployer should lost access
    const newOwner = hre.ethers.getAddress("0x0000000000000000000000000000000000000001");
    await expect(
        namespaceRegistry.connect(deployer).setNamespace(
            ns,
            newOwner,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(deployer).setOwner(
            ns,
            newOwner
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(deployer).setRegistry(
            ns,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );

    // transfer ownership
    await expect(
        namespaceRegistry.connect(tester).setNamespace(
            ns,
            newOwner,
            ensRegistryAddr,
        )
    ).to.emit(namespaceRegistry, "NewOwner").withArgs(ns, newOwner);

    // tester should lost access
    await expect(
        namespaceRegistry.connect(tester).setNamespace(
            ns,
            tester.address,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(tester).setOwner(
            ns,
            tester.address
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
    await expect(
        namespaceRegistry.connect(tester).setRegistry(
            ns,
            ensRegistryAddr,
        )
    ).to.be.revertedWithCustomError(
        namespaceRegistry,
        "NotAuthorised"
    );
  });

  it("should test ens registry", async function() {
    const tokenId = hash("peter");
    const node = hre.ethers.keccak256(
        hre.ethers.solidityPacked(
            ['bytes32', 'bytes32'],
            [hash("eth"), tokenId]
        )
    );

    const expectedUrl =
        `w3://0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e:1/resolver/${node}?returns=(address)`;
    await expect(
        ensRegistryProxy.resolverOf(tokenId)
    ).to.be.revertedWithCustomError(
        ensRegistryProxy,
        "CrossChainLookup"
    ).withArgs(expectedUrl);
  });
});
