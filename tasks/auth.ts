import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers, Contract, BigNumber, Signer } from "ethers";
import { getHexlink } from "./hexlink";

const buildAuthProof = async function (
  hre: HardhatRuntimeEnvironment,
  params: {
    name: string,
    func: string,
    owner: string,
    validator: Signer,
    hexlink: Contract,
  }
) {
  const requestId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes4", "address", "uint256", "address"],
      [
        params.func,
        params.hexlink.address,
        hre.network.config.chainId,
        params.owner
      ]
    )
  );
  const expiredAt = Math.round(Date.now() / 1000) + 3600;
  const validator = await params.validator.getAddress();
  const message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "uint256", "address"],
      [params.name, requestId, expiredAt, validator]
    )
  );
  const signature = await params.validator.signMessage(
    ethers.utils.arrayify(message)
  );
  const proof = ethers.utils.defaultAbiCoder.encode(
    ["uint256", "address", "bytes"],
    [expiredAt, validator, signature]
  )
  return proof;
};

task("build_deploy_auth_proof", "build auth proof")
  .addParam("name")
  .addOptionalParam("owner")
  .addOptionalParam("validator")
  .addOptionalParam("hexlink")
  .setAction(async (args, hre: HardhatRuntimeEnvironment) => {
    const hexlink = await getHexlink(hre, args.hexlink);
    const signers = await hre.ethers.getNamedSigners();
    const validator = args.validator ? signers[args.validator] : signers.validator;
    return await buildAuthProof(hre, {
      name: args.name,
      func: hexlink.interface.getSighash("deploy"),
      owner: args.owner,
      validator,
      hexlink,
    });
  });