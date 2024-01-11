
///////////////
// Variables //
///////////////

const fs = require('fs');
const exec = require('node:child_process').exec;
const spawn = require('node:child_process').spawn;
const PassThrough = require('stream').PassThrough

let nodes = [];
let shouldRun = true;

///////////
// Nodes //
///////////

function nodesBusy() {
    for (let i = 0; i < nodes.length; i++) { if (nodes[i].running) { return true; } }
    return false;
}

function createNode(folder, name) {
    nodes.push({ name: name, folder: folder, running: false, ready: false, log: "" });
}

async function awaitReady(index) {
    while(!nodes[index].ready) {
        await sleep(0.25);
    }
}

async function startNode(index) {
    if (nodes[index].running) { return; }
    let folder = nodes[index].folder;

    try {
        nodes[index].proc = exec(`updateNode.sh ${nodes[index].folder}`, { } , (err, stdout, stderr) => {
            if (err) { logError(err); }
            if (stdout) { logInfo(stdout); }
            if (stderr) { logError(stderr); }
        });
        nodes[index].running = true;
    } catch (err) { logError(err); return; }
    // Log restarts and such
    nodes[index].proc.on("exit", err => { logInfo(folder + " completed updating."); nodes[index].ready = true; });

    await awaitReady(index);
    nodes[index].ready = false;
    const now = new Date();
    let fileHandle = fs.openSync(`logs\\${nodes[index].name.substring(0, nodes[index].name.length-5)}\\${now.getFullYear()}-${now.getMonth()}-${now.getDay()}_${getTimeString(now).replaceAll(":", ".")}.txt`, 'w');
    nodes[index].proc = spawn(`node`, [folder], { stdio: ['ignore', fileHandle, fileHandle] });
    nodes[index].proc.on("exit", async err => { logInfo(folder + " stopped running..."); await sleep(0.5); fs.closeSync(fileHandle); restartNode(folder); });
}

function restartNode(folder) {
    if (!shouldRun) { return; }
    let found = -1;
    for (let i = 0; i < nodes.length; i++) { if (equals(nodes[i].folder, folder)) { found = i; break;} }
    nodes[found].running = false;
    if (found < 0) { return; }
    startNode(found);
    logInfo("Restarted " + folder)
}

async function start() {
    logInfo("Console started, initializing bots...");

    { // Load nodes to start
        let nodeList = listFilesInFolder(__dirname + "\\nodes\\");
        for (let i = 0; i < nodeList.length; i++) {
            let params = nodeList[i].split(".");
            if (params.length < 1) { continue; }
            const type = params[params.length - 1];
            if (equals(type, "node")) {
                const folder = readFile(__dirname + "\\nodes\\" + nodeList[i])[0];
                createNode(folder, nodeList[i]);
            }
        }
    }

    // Start nodes
    for (let i = 0; i < nodes.length; i++) { startNode(i); }

    // Keep program alive
    logInfo("Nodes initialized successfully!");
    while (nodesBusy() || shouldRun) { await sleep(1); } // Keep program alive so bots can keep responding without being on the main call thread
    logInfo("Program stopped!");
}

///////////////////////
// Utility functions //
///////////////////////

function equals(first, second) {
    switch (first) {
        case second: return true;
        default: return false;
    }
}

function logErrorToFile(log, err)   { logError(err); }
function logWarningToFile(log, err) { logWarning(err); }
function logInfoToFile(log, info)   { logInfo(info); }

async function sleep(seconds) { return new Promise(resolve => setTimeout(resolve, Math.max(seconds, 0) * 1000)); }
function getTimeString(date = new Date()) { return date.toLocaleTimeString(); }
function logError(err)   { console.error(`[${getTimeString()}] ERROR:\t`, err ); }
function logWarning(err) { console.error(`[${getTimeString()}] Warning:`, err ); }
function logInfo(info)   { console.log  (`[${getTimeString()}] Info:\t` , info); }
function logData(data)   { console.log  (data); }

function readFile(path) {
    try {
        const data = fs.readFileSync(path, 'utf8').split("\n");
        let lines = [];
        for (let i = 0; i < data.length; i++) {
            let line = data[i];
            if (line.endsWith("\r")) { line = line.substring(0, line.length - 1); } // Make sure lines don't end with the first half of the windows end line characters
            line = line.trim(); // Make sure lines don't end with a space character
            if (line.length) { lines.push(line); }
        }
        return lines;
    } catch (err) { logError(err); return []; }
}

function listFilesInFolder(path) {
    if (!fs.statSync(path).isDirectory()) { return []; } // Return early if file is not a directory
    let result = [];
    const files = fs.readdirSync(path);
    for (let i = 0; i < files.length; i++) { result.push("" + files[i]); }
    return result;
}

/////////////
// Program //
/////////////

start().catch(err => { logError(err); });