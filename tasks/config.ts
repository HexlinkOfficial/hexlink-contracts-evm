import {task} from "hardhat/config";
import {HardhatRuntimeEnvironment} from "hardhat/types";

import * as config from '../config.json';
import * as fs from 'fs';

task("loadConfig")
    .addParam("key", "key to lookup")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        let netConf = config[hre.network.name as keyof typeof config] || {};
        return (netConf as any)[args.key];
    });

task("updateConfig")
    .addParam("key", "key to write")
    .addParam("value", "json string of the config to write")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        (config as any)[hre.network.name][args.key] = JSON.parse(args.value);
        fs.writeFileSync("../config.json", JSON.stringify(config, null, 4));
    });