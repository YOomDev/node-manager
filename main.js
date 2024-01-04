
///////////////
// Variables //
///////////////

const fs = require('fs');
const exec = require('node:child_process').exec;

let nodes = [];
let shouldRun = true;

///////////
// Nodes //
///////////

function nodesBusy() {
    for (let i = 0; i < nodes.length; i++) { if (nodes[i].running) { return true; } }
    return false;
}

function createNode(folder) {
    nodes.push({ folder: folder, running: false });
}

function startNode(index) {
    if (nodes[index].running) { return; }
    let folder = nodes[index].folder
    try {
        nodes[index].proc = exec(`updateNode.sh ${nodes[index].folder}`, (err, stdout, stderr) => {
            if (err) { logError(err); }
            if (stdout) { logInfo(stdout); }
            if (stderr) { logError(stderr); }
        });
        nodes[index].running = true;
    } catch (err) { logError(err); return; }
    nodes[index].proc.on("exit", err => { logInfo(folder + " stopped running..."); restartNode(folder);});
    nodes[index].proc.on("error", err => { logError(err); });
    nodes[index].proc.on("message", msg => { logInfo(msg); });
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
                createNode(folder);
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

async function sleep(seconds) { return new Promise(resolve => setTimeout(resolve, Math.max(seconds, 0) * 1000)); }
function getTimeString() { return (new Date()).toLocaleTimeString(); }
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
            while (line.endsWith(" ")) { line = line.substring(0, line.length - 1); } // Make sure lines don't end with a space character
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