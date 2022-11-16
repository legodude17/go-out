#!/usr/bin/env node

import app from "./index.js";

process.exitCode = (await app.run()) ? 0 : 1;
