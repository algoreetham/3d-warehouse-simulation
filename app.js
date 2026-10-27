/* ═══════════════════════════════════════════
       SECTION 1: AUDIO SYNTHESIZER
       ═══════════════════════════════════════════ */
    class SoundFX {
        constructor(){ this.enabled=true; this.ctx=null; }
        init(){ if(!this.ctx){ const A=window.AudioContext||window.webkitAudioContext; if(A) this.ctx=new A(); } }
        tone(f,type='sine',dur=0.08,g=0.08){
            if(!this.enabled) return;
            try{
                this.init(); if(!this.ctx) return;
                if(this.ctx.state==='suspended') this.ctx.resume();
                const o=this.ctx.createOscillator(), gn=this.ctx.createGain();
                o.type=type; o.frequency.setValueAtTime(f,this.ctx.currentTime);
                gn.gain.setValueAtTime(g,this.ctx.currentTime);
                gn.gain.exponentialRampToValueAtTime(0.0001,this.ctx.currentTime+dur);
                o.connect(gn); gn.connect(this.ctx.destination);
                o.start(); o.stop(this.ctx.currentTime+dur);
            }catch(e){}
        }
        click(){ this.tone(850,'triangle',0.04,0.06); }
        step(){ this.tone(520,'sine',0.06,0.08); }
        alert(){ this.tone(320,'sawtooth',0.15,0.12); setTimeout(()=>this.tone(260,'sawtooth',0.18,0.12),90); }
        yieldWarn(){ this.tone(440,'triangle',0.1,0.08); setTimeout(()=>this.tone(380,'triangle',0.12,0.08),80); }
        chime(){ this.tone(600,'sine',0.08,0.08); setTimeout(()=>this.tone(880,'sine',0.12,0.08),70); }
    }
    const sfx = new SoundFX();

    /* ═══════════════════════════════════════════
       SECTION 2: GRAPH DATA STRUCTURE
       ═══════════════════════════════════════════ */
    class WarehouseGraph {
        constructor(n) { this.n=n; this.adj=Array.from({length:n},()=>[]); }
        addEdge(u,v,w) {
            this.adj[u].push({v,w,origW:w,blocked:false});
            this.adj[v].push({v:u,w,origW:w,blocked:false});
        }
        blockEdge(u,v) {
            for(const e of this.adj[u]) if(e.v===v){e.w=Infinity;e.blocked=true;}
            for(const e of this.adj[v]) if(e.v===u){e.w=Infinity;e.blocked=true;}
        }
        unblockEdge(u,v) {
            for(const e of this.adj[u]) if(e.v===v){e.w=e.origW;e.blocked=false;}
            for(const e of this.adj[v]) if(e.v===u){e.w=e.origW;e.blocked=false;}
        }
        isBlocked(u,v) { for(const e of this.adj[u]) if(e.v===v) return e.blocked; return false; }
        shortestPath(src,tgt) {
            if(src===tgt) return {path:[src],cost:0};
            const d=new Array(this.n).fill(Infinity), par=new Array(this.n).fill(-1), vis=new Array(this.n).fill(false);
            const pq=[{d:0,u:src}]; d[src]=0;
            while(pq.length){
                pq.sort((a,b)=>a.d-b.d); const{d:dd,u}=pq.shift();
                if(vis[u]) continue; vis[u]=true; if(u===tgt) break;
                for(const{v,w}of this.adj[u]){
                    if(w===Infinity) continue;
                    if(!vis[v]&&d[u]!==Infinity&&d[u]+w<d[v]){d[v]=d[u]+w;par[v]=u;pq.push({d:d[v],u:v});}
                }
            }
            if(d[tgt]===Infinity) return {path:[],cost:-1};
            const p=[]; for(let c=tgt;c!==-1;c=par[c]) p.push(c); p.reverse();
            return {path:p,cost:d[tgt]};
        }
    }

    class Task { constructor(id,targetNode,priority){this.id=id;this.targetNode=targetNode;this.priority=priority;} }

    /* ═══════════════════════════════════════════
       SECTION 3: EXPANDED 12-STATION TOPOLOGY
       ═══════════════════════════════════════════ */
    // 12 Hubs covering the entire warehouse
    const STATIONS = {
        0:  { x: -25, z:   6, label:"INBOUND DOCK A 0", code:"DOCK-0A", type:"dock", color: 0x38bdf8 },
        1:  { x:  -8, z: -12, label:"NORTH SORTATION 1", code:"SORT-01", type:"sorting", color: 0xf59e0b },
        2:  { x:  -2, z:  10, label:"CENTRAL CROSSWAY 2", code:"HUB-02", type:"hub", color: 0xa855f7 },
        3:  { x:  14, z: -12, label:"PACKING LINE A 3", code:"PACK-0A", type:"packing", color: 0x10b981 },
        4:  { x:  26, z:   8, label:"SHIPPING BAY A 4", code:"SHIP-0A", type:"shipping", color: 0xef4444 },
        5:  { x: -14, z:  22, label:"PALLET STORAGE 5", code:"STG-05", type:"storage", color: 0xfacc15 },
        6:  { x: -25, z:  -8, label:"INBOUND DOCK B 6", code:"DOCK-0B", type:"dock", color: 0x38bdf8 },
        7:  { x:   0, z:  -2, label:"QUALITY INSPECT 7", code:"QC-07", type:"hub", color: 0x06b6d4 },
        8:  { x:  14, z:   8, label:"PACKING LINE B 8", code:"PACK-0B", type:"packing", color: 0x10b981 },
        9:  { x:  26, z:  -8, label:"SHIPPING BAY B 9", code:"SHIP-0B", type:"shipping", color: 0xef4444 },
        10: { x:   2, z:  24, label:"DEEP COLD STORAGE 10", code:"COLD-10", type:"storage", color: 0x60a5fa },
        11: { x:   3, z: -24, label:"CHARGING DEPOT 11", code:"CHG-11", type:"depot", color: 0x34d399 }
    };

    // 32 Corridors: includes canonical 8-edge subgraph, 14 expansion routes + 10 extra express routes
    const EDGES = [
        // Canonical C++ original 8 edges
        [0, 1, 2], [1, 2, 2], [2, 3, 2], [3, 4, 2],
        [1, 4, 5], [0, 5, 4], [5, 4, 3], [2, 5, 1],

        // Expansion transit routes across 12-hub warehouse
        [0, 6, 2],  // Dock A <-> Dock B
        [6, 1, 3],  // Dock B <-> North Sortation
        [1, 7, 2],  // North Sortation <-> Inspection Hub
        [7, 2, 2],  // Inspection Hub <-> Central Crossway
        [7, 3, 2],  // Inspection Hub <-> Packing Line A
        [3, 9, 3],  // Packing Line A <-> Shipping Bay B
        [4, 9, 2],  // Shipping Bay A <-> Shipping Bay B
        [2, 8, 3],  // Central Crossway <-> Packing Line B
        [8, 4, 2],  // Packing Line B <-> Shipping Bay A
        [5, 10, 2], // Pallet Storage <-> Deep Storage
        [10, 8, 3], // Deep Storage <-> Packing Line B
        [1, 11, 2], // North Sortation <-> Maintenance Depot
        [11, 3, 3], // Maintenance Depot <-> Packing Line A
        [6, 11, 3], // Dock B <-> Maintenance Depot

        // 10 NEW INDUSTRIAL EXPRESS TRANSIT ROUTES (TOTAL: 32 ROUTES)
        [0, 2, 3],  // Route 23: Express Dock A <-> Central Crossway Direct
        [7, 8, 2],  // Route 24: Inspection Hub <-> Packing Line B Direct
        [6, 7, 3],  // Route 25: Dock B <-> Inspection Hub
        [8, 9, 2],  // Route 26: Packing Line B <-> Shipping Bay B
        [10, 2, 3], // Route 27: Deep Cold Storage <-> Central Crossway
        [11, 7, 3], // Route 28: Maintenance Depot <-> Inspection Hub
        [1, 8, 3],  // Route 29: North Sortation <-> Packing Line B Direct Express
        [10, 4, 4], // Route 30: Deep Cold Storage <-> Shipping Bay A Express
        [11, 9, 4], // Route 31: Maintenance Depot <-> Shipping Bay B Outbound
        [6, 5, 4]   // Route 32: Inbound Dock B <-> Pallet Storage Direct
    ];

    // 5 Distinct Parking Berths per station to prevent any overlap
    const BERTH_OFFSETS = [
        { dx:  0.0, dz:  0.0 }, // Berth 0 (Center Pad)
        { dx: -2.3, dz:  0.0 }, // Berth 1 (West)
        { dx:  2.3, dz:  0.0 }, // Berth 2 (East)
        { dx:  0.0, dz:  2.3 }, // Berth 3 (South)
        { dx:  0.0, dz: -2.3 }  // Berth 4 (North)
    ];

    /* ═══════════════════════════════════════════
       SECTION 4: ROBOT & ZERO-COLLISION SCHEDULER
       ═══════════════════════════════════════════ */
    const FLEET_CONFIG = [
        { id: 101, name: "AGV-101 (Alpha)", color: 0xf59e0b, hex: '#f59e0b', startNode: 0, priority: 5 },
        { id: 102, name: "AGV-102 (Beta)",  color: 0x0284c7, hex: '#0284c7', startNode: 5, priority: 2 },
        { id: 103, name: "AGV-103 (Gamma)", color: 0x10b981, hex: '#10b981', startNode: 6, priority: 4 },
        { id: 104, name: "AGV-104 (Delta)", color: 0xef4444, hex: '#ef4444', startNode: 10, priority: 3 },
        { id: 105, name: "AGV-105 (Echo)",  color: 0xa855f7, hex: '#a855f7', startNode: 7, priority: 6 }
    ];

    class Robot {
        constructor(id, startNode, colorHex, colorInt, name){
            this.id = id;
            this.name = name || `AGV-${id}`;
            this.currentNode = startNode;
            this.active = true;
            this.task = null;
            this.path = [];
            this.colorHex = colorHex;
            this.colorInt = colorInt;
            this.waiting = false;
            this.yieldReason = "";
            this.battery = 98;
            this.berthIndex = 0;

            // Animation state
            this.animProgress = 1;
            this.animFrom = startNode;
            this.animTo = startNode;
            this.pos = { x: 0, z: 0 };
            this.speedFactor = 1.0;

            // 3D Meshes
            this.mesh = null;
            this.beaconMesh = null;
            this.headLight = null;
            this.tailLightMesh = null;
            this.cargoMesh = null;
            this.safetyRing = null;
            this.lidarBeam = null;
            this.wheels = [];
        }

        getBerthPosition(nodeId, slotIdx) {
            const st = STATIONS[nodeId];
            const b = BERTH_OFFSETS[slotIdx % BERTH_OFFSETS.length];
            return { x: st.x + b.dx, z: st.z + b.dz };
        }
    }

    class CollisionFreeScheduler {
        constructor(graph){
            this.graph = graph;
            this.robots = [];
            this.conflictCount = 0;
        }

        addRobot(id, startNode, colorHex, colorInt, name){
            const r = new Robot(id, startNode, colorHex, colorInt, name);
            this.robots.push(r);
            this.updateBerthAssignments();
            return r;
        }

        getRobot(id){ return this.robots.find(r => r.id === id); }

        updateBerthAssignments(){
            const nodeGroups = {};
            for(let i=0; i<12; i++) nodeGroups[i] = [];
            for(const r of this.robots){
                if(r.animProgress >= 1 || r.waiting){
                    nodeGroups[r.currentNode].push(r);
                }
            }
            for(let i=0; i<12; i++){
                nodeGroups[i].forEach((r, idx) => {
                    r.berthIndex = idx;
                });
            }
        }

        assignTask(robotId, task){
            const r = this.getRobot(robotId);
            if(!r || !r.active) return;
            r.task = task;
            const { path, cost } = this.graph.shortestPath(r.currentNode, task.targetNode);
            if(cost === -1){
                r.path = [];
                logEngine(`Dijkstra: No feasible path for ${r.name} to Node ${task.targetNode}`, 'log-fault');
                return;
            }
            r.path = [...path];
            r.waiting = false;
            r.yieldReason = "";
            logEngine(`Dijkstra: ${r.name} assigned Task ${task.id} (Priority ${task.priority}) -> cost=${cost}, route: ${path.join(' → ')}`, 'log-dijkstra');
            sfx.chime();
        }

        /* ─── INTERACTIVE ROUTE ASSIGNMENT & PROACTIVE CONFLICT-GUARD ─── */
        assignInteractiveCollisionRoute(robotId, targetNode, priority = 5){
            const r = this.getRobot(robotId);
            if(!r || !r.active){
                showConflictToast("danger", "AGV FAULT", `Cannot assign route: ${r ? r.name : 'Robot'} is inactive or in motor fault!`);
                return;
            }
            if(r.currentNode === targetNode){
                showConflictToast("warning", "AT DESTINATION", `${r.name} is already stationed at Station ${targetNode}.`);
                return;
            }

            const taskId = Math.floor(100 + Math.random()*900);
            const task = new Task(taskId, targetNode, priority);
            r.task = task;

            // Step 1: Calculate raw direct Dijkstra shortest path
            const direct = this.graph.shortestPath(r.currentNode, targetNode);
            if(direct.cost === -1 || direct.path.length < 2){
                r.path = [];
                showConflictToast("danger", "NO PATH", `No accessible route found for ${r.name} to Station ${targetNode}!`);
                logEngine(`Interactive Router: Station ${targetNode} is unreachable for ${r.name}`, 'log-fault');
                return;
            }

            // Step 2: Proactive Multi-Robot Conflict Detection
            // Check prospective trajectory against other active robot paths
            let conflictDetected = false;
            let conflictRobot = null;
            let conflictType = null;
            let contestedEdge = null;
            let contestedNode = null;

            for(const other of this.robots){
                if(other.id === robotId || !other.active || other.path.length <= 1) continue;

                // Check 2a: Head-on corridor collision (traveling along same corridor in opposite directions)
                if(r.currentNode === other.path[1] && direct.path[1] === other.currentNode){
                    conflictDetected = true;
                    conflictRobot = other;
                    conflictType = "head-on";
                    contestedEdge = [r.currentNode, direct.path[1]];
                    break;
                }

                // Check 2b: Simultaneous junction arrival (both entering same junction node at next step)
                if(direct.path[1] === other.path[1]){
                    conflictDetected = true;
                    conflictRobot = other;
                    conflictType = "junction";
                    contestedNode = direct.path[1];
                    break;
                }

                // Check 2c: Destination contention (other robot parked or terminating at target berth)
                if(targetNode === other.currentNode && other.path.length === 0){
                    // Not a fatal corridor collision, handled by multi-berth pad
                }
            }

            // Step 3: Zero-Collision Resolution Strategy
            if(!conflictDetected){
                // Route is crystal clear!
                r.path = [...direct.path];
                r.waiting = false;
                r.yieldReason = "";
                showConflictToast("success", "ROUTE ASSIGNED", `✅ ${r.name} assigned shortest path: ${r.path.join(' → ')} [Cost: ${direct.cost}]`);
                logEngine(`Interactive Router: ${r.name} assigned optimal route ${r.path.join(' → ')} (cost=${direct.cost}) - All clear!`, 'log-dijkstra');
                sfx.chime();
            } else {
                // A prospective collision was detected with conflictRobot!
                const otherPri = conflictRobot.task ? conflictRobot.task.priority : 0;
                logEngine(`SAFETY INTERLOCK: Prospective ${conflictType} collision between ${r.name} and ${conflictRobot.name}!`, 'log-conflict');

                if(priority > otherPri){
                    // This robot has higher priority! It takes direct path.
                    // Subordinate the other robot (yield hold or alternate detour).
                    r.path = [...direct.path];
                    r.waiting = false;
                    r.yieldReason = "";

                    // Force other robot to yield or detour
                    conflictRobot.waiting = true;
                    conflictRobot.yieldReason = `Yielding for higher-priority ${r.name}`;
                    showConflictToast("reroute", "PRIORITY OVERRIDE", `🛡️ Collision Prevented! ${r.name} (P:${priority}) holds right-of-way. ${conflictRobot.name} yielding in berth.`);
                    logEngine(`Interactive Router: ${conflictRobot.name} instructed to yield in berth for priority ${r.name}`, 'log-conflict');
                    sfx.yieldWarn();
                } else {
                    // This robot has equal or lower priority!
                    // Automatically calculate alternate Dijkstra bypass around the contested corridor/junction.
                    let altPath = null;
                    let altCost = -1;

                    if(contestedEdge){
                        this.graph.blockEdge(contestedEdge[0], contestedEdge[1]);
                        const alt = this.graph.shortestPath(r.currentNode, targetNode);
                        this.graph.unblockEdge(contestedEdge[0], contestedEdge[1]);
                        if(alt.cost !== -1 && alt.path.length > 1){
                            altPath = alt.path;
                            altCost = alt.cost;
                        }
                    } else if(contestedNode !== null){
                        // Temporarily isolate contested junction node from current node
                        this.graph.blockEdge(r.currentNode, contestedNode);
                        const alt = this.graph.shortestPath(r.currentNode, targetNode);
                        this.graph.unblockEdge(r.currentNode, contestedNode);
                        if(alt.cost !== -1 && alt.path.length > 1){
                            altPath = alt.path;
                            altCost = alt.cost;
                        }
                    }

                    if(altPath){
                        // Alternate bypass found!
                        r.path = [...altPath];
                        r.waiting = false;
                        r.yieldReason = `Bypass around corridor conflict with ${conflictRobot.name}`;
                        showConflictToast("reroute", "COLLISION AVOIDED", `🛡️ Rerouted ${r.name} via bypass ${altPath.join(' → ')} [Cost: ${altCost}] to prevent crash with ${conflictRobot.name}!`);
                        logEngine(`Interactive Router: ${r.name} automatically detoured via ${altPath.join(' → ')} (cost=${altCost}) preventing collision!`, 'log-reroute');
                        sfx.yieldWarn();
                    } else {
                        // No alternate corridor exists: place robot into automated time-space yield hold
                        r.path = [...direct.path];
                        r.waiting = true;
                        r.yieldReason = `Time-Space Hold: Waiting for ${conflictRobot.name} to clear corridor`;
                        showConflictToast("warning", "YIELD HOLD ENGAGED", `🛡️ Collision Prevented! ${r.name} holding in berth until ${conflictRobot.name} clears corridor.`);
                        logEngine(`Interactive Router: ${r.name} placed in coordinated time-space hold for ${conflictRobot.name}`, 'log-conflict');
                        sfx.yieldWarn();
                    }
                }
            }

            this.updateBerthAssignments();
            renderFleetCards();
            updateRouteRibbons();
        }

        /* ─── TIME-SPACE RESERVATION & MULTI-AGENT INTERLOCK ─── */
        resolveConflicts(){
            const nextNodeMap = {};
            for(let i = 0; i < this.robots.length; i++){
                const r = this.robots[i];
                if(r.active && r.path.length > 1){
                    const next = r.path[1];
                    if(!nextNodeMap[next]) nextNodeMap[next] = [];
                    nextNodeMap[next].push(i);
                }
            }

            let collisionWarning = false;
            let warningText = "";

            // 1. Next-Node Collision Arbitration
            for(const node in nextNodeMap){
                const group = nextNodeMap[node];
                if(group.length < 2) continue;

                this.conflictCount++;
                collisionWarning = true;

                let bestIdx = group[0];
                for(const idx of group){
                    const cp = this.robots[idx].task ? this.robots[idx].task.priority : 0;
                    const bp = this.robots[bestIdx].task ? this.robots[bestIdx].task.priority : 0;
                    if(cp > bp) bestIdx = idx;
                }

                const winner = this.robots[bestIdx];
                winner.waiting = false;
                winner.yieldReason = "";
                logEngine(`Conflict at Node ${node} -> ${winner.name} (Priority ${winner.task?winner.task.priority:0}) proceeds.`, 'log-conflict');

                for(const idx of group){
                    if(idx === bestIdx) continue;
                    const loser = this.robots[idx];
                    loser.waiting = true;
                    loser.yieldReason = `Yielding at Station ${loser.currentNode} for ${winner.name}`;
                    warningText = `COLLISION INTERLOCK: ${loser.name} YIELDING FOR ${winner.name}`;

                    // Attempt alternative route avoiding contested node
                    this.graph.blockEdge(loser.currentNode, parseInt(node));
                    const alt = this.graph.shortestPath(loser.currentNode, loser.task.targetNode);
                    this.graph.unblockEdge(loser.currentNode, parseInt(node));

                    if(alt.cost !== -1 && alt.path.length > 1){
                        loser.path = [...alt.path];
                        loser.waiting = false;
                        loser.yieldReason = `Rerouted via alternate corridor to avoid ${winner.name}`;
                        logEngine(`${loser.name} rerouted via alternate path: ${alt.path.join(' → ')} (cost=${alt.cost})`, 'log-reroute');
                    } else {
                        logEngine(`${loser.name} waiting in berth at Station ${loser.currentNode} until ${winner.name} clears junction.`, 'log-conflict');
                    }
                }
            }

            // 2. Head-on Corridor Interlock (Opposite Direction Aisle Hazard)
            for(let i=0; i<this.robots.length; i++){
                for(let j=i+1; j<this.robots.length; j++){
                    const rA = this.robots[i], rB = this.robots[j];
                    if(rA.active && rB.active && rA.path.length > 1 && rB.path.length > 1){
                        if(rA.currentNode === rB.path[1] && rB.currentNode === rA.path[1]){
                            collisionWarning = true;
                            const pA = rA.task ? rA.task.priority : 0;
                            const pB = rB.task ? rB.task.priority : 0;
                            if(pA >= pB){
                                rB.waiting = true;
                                rB.yieldReason = `Head-on interlock: Holding for ${rA.name} to clear aisle`;
                                warningText = `HEAD-ON INTERLOCK: ${rB.name} HOLDING FOR ${rA.name}`;
                                logEngine(`Head-on Interlock: ${rB.name} holding in berth for higher-priority ${rA.name}`, 'log-conflict');
                            } else {
                                rA.waiting = true;
                                rA.yieldReason = `Head-on interlock: Holding for ${rB.name} to clear aisle`;
                                warningText = `HEAD-ON INTERLOCK: ${rA.name} HOLDING FOR ${rB.name}`;
                                logEngine(`Head-on Interlock: ${rA.name} holding in berth for higher-priority ${rB.name}`, 'log-conflict');
                            }
                        }
                    }
                }
            }

            // Update UI status banner
            const pill = document.getElementById('lblCollisionStatus');
            const pillTxt = document.getElementById('lblCollisionText');
            if(collisionWarning){
                pill.className = "collision-pill warning";
                pillTxt.textContent = warningText || "ACTIVE SAFETY INTERLOCK // YIELD PROTOCOL ENGAGED";
                sfx.yieldWarn();
            } else {
                pill.className = "collision-pill";
                pillTxt.textContent = "0 COLLISIONS DETECTED // ALL 22 CORRIDORS CLEAR";
            }
        }

        stepSimulation(){
            this.resolveConflicts();
            let moved = false;

            for(const r of this.robots){
                if(!r.active) continue;
                if(r.waiting) continue;

                // Never interrupt or teleport an AGV currently traveling along a corridor!
                if(r.animProgress < 1.0){
                    continue;
                }

                if(r.path.length > 1){
                    r.animFrom = r.currentNode;
                    r.animTo = r.path[1];
                    r.animProgress = 0;
                    r.path.shift();
                    r.waiting = false;
                    r.yieldReason = "";
                    r.battery = Math.max(12, r.battery - 1);
                    moved = true;
                    logEngine(`${r.name} dispatched along corridor ${r.animFrom} ➔ ${r.animTo}`, 'log-step');
                }
            }

            this.updateBerthAssignments();
            if(moved) sfx.step();
            return moved;
        }

        failRobot(id){
            const r = this.getRobot(id);
            if(!r) return;
            r.active = false;
            r.waiting = false;
            r.yieldReason = "MOTOR SYSTEM FAULT // SAFE LOCKOUT";
            logEngine(`EMERGENCY: ${r.name} has FAILED. Safety lockout engaged.`, 'log-fault');
            sfx.alert();
            this.updateBerthAssignments();
        }

        repairRobot(id){
            const r = this.getRobot(id);
            if(!r) return;
            r.active = true;
            r.waiting = false;
            r.yieldReason = "";
            logEngine(`${r.name} REPAIRED and restored to active duty.`, 'log-step');
            sfx.chime();
            if(r.task){
                const { path } = this.graph.shortestPath(r.currentNode, r.task.targetNode);
                r.path = [...path];
            }
            this.updateBerthAssignments();
        }

        blockCorridor(u,v){
            this.graph.blockEdge(u,v);
            logEngine(`Corridor ${u}-${v} BLOCKED! Edge cost=∞. Rerouting fleet...`, 'log-reroute');
            sfx.alert();
            for(const r of this.robots){
                if(r.active && r.task){
                    const { path, cost } = this.graph.shortestPath(r.currentNode, r.task.targetNode);
                    r.path = [...path];
                    logEngine(`${r.name} rerouted, new cost=${cost}, route: ${path.join(' → ')}`, 'log-reroute');
                }
            }
        }

        unblockCorridor(u,v){
            this.graph.unblockEdge(u,v);
            logEngine(`Corridor ${u}-${v} UNBLOCKED! Normal routing resumed.`, 'log-step');
            sfx.chime();
            for(const r of this.robots){
                if(r.active && r.task){
                    const { path } = this.graph.shortestPath(r.currentNode, r.task.targetNode);
                    r.path = [...path];
                }
            }
        }
    }

    /* ─── LIVE C++ ENGINE LOGGER ─── */
    function logEngine(msg, cls = '') {
        const el = document.getElementById('liveLogContent');
        if(!el) return;
        const div = document.createElement('div');
        div.className = `log-entry ${cls}`;
        div.innerHTML = `<span class="log-time">[T=${simClock}]</span> ${msg}`;
        el.appendChild(div);
        el.scrollTop = el.scrollHeight;
    }

    /* ═══════════════════════════════════════════
       SECTION 5: THREE.JS 3D SCENE SETUP
       ═══════════════════════════════════════════ */
    let scene, camera, renderer, controls;
    let warehouseGraph, scheduler;
    let simClock = 0, speedMult = 1, isAutoPlaying = false, playInterval = null;
    let camMode = 'orbit';
    let decorGroup, decorVisible = true;
    let activeScenarioIndex = 1;

    const stationMeshes = {};
    const edgeMeshes = {};
    const edgeLabelMeshes = {};
    const edgeBarrierMeshes = {};
    const rackGroups = [];

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const clickableObjects = [];

    // Interactive Route Planning & Zero-Collision Ribbon Visuals
    let selectedRobotId = 101;
    let selectedStationId = 4;
    let clickToRouteMode = true;
    let routeRibbonsGroup = null;
    let robotSelectionRing = null;
    let stationSelectionRing = null;
    let robotSpotlight = null;
    let stationSpotlight = null;
    let robotBeamMesh = null;
    let stationBeamMesh = null;

    function initThree() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x060912);
        scene.fog = new THREE.FogExp2(0x060912, 0.0032);

        const vp = document.getElementById('viewport');
        camera = new THREE.PerspectiveCamera(50, vp.clientWidth / vp.clientHeight, 0.1, 700);
        camera.position.set(0, 36, 46);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.setSize(vp.clientWidth, vp.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        vp.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.maxPolarAngle = Math.PI / 2 - 0.04;
        controls.minDistance = 6;
        controls.maxDistance = 110;
        controls.target.set(0, 0, 2);

        // Lighting: Industrial dark warehouse aesthetic so spotlights pop dramatically
        const ambient = new THREE.AmbientLight(0x283344, 0.85);
        scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xfffaea, 0.95);
        sun.position.set(35, 60, 25);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 180;
        sun.shadow.camera.left = -50;
        sun.shadow.camera.right = 50;
        sun.shadow.camera.top = 50;
        sun.shadow.camera.bottom = -50;
        scene.add(sun);

        // Warm subtle floor accents
        const spot1 = new THREE.PointLight(0x38bdf8, 0.35, 55);
        spot1.position.set(-20, 14, 5); scene.add(spot1);
        const spot2 = new THREE.PointLight(0xfacc15, 0.3, 55);
        spot2.position.set(20, 14, 5); scene.add(spot2);

        // High-Intensity 3D Robot Focused Spotlight (Follows Selected AGV)
        robotSpotlight = new THREE.SpotLight(0xf59e0b, 8.5, 65, Math.PI / 7, 0.35, 1.1);
        robotSpotlight.position.set(0, 28, 0);
        robotSpotlight.castShadow = true;
        scene.add(robotSpotlight);
        scene.add(robotSpotlight.target);

        // Volumetric 3D Light Cone for Robot Spotlight
        const rBeamGeom = new THREE.CylinderGeometry(0.7, 3.8, 28, 32, 1, true);
        rBeamGeom.translate(0, -14, 0);
        const rBeamMat = new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            transparent: true,
            opacity: 0.26,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        robotBeamMesh = new THREE.Mesh(rBeamGeom, rBeamMat);
        robotBeamMesh.position.set(0, 28, 0);
        scene.add(robotBeamMesh);

        // High-Intensity 3D Station Focused Spotlight (Highlights Target Destination)
        stationSpotlight = new THREE.SpotLight(0x10b981, 7.5, 65, Math.PI / 6, 0.35, 1.1);
        stationSpotlight.position.set(0, 28, 0);
        stationSpotlight.castShadow = true;
        scene.add(stationSpotlight);
        scene.add(stationSpotlight.target);

        // Volumetric 3D Light Cone for Station Spotlight
        const sBeamGeom = new THREE.CylinderGeometry(0.9, 4.4, 28, 32, 1, true);
        sBeamGeom.translate(0, -14, 0);
        const sBeamMat = new THREE.MeshBasicMaterial({
            color: 0x10b981,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        stationBeamMesh = new THREE.Mesh(sBeamGeom, sBeamMat);
        stationBeamMesh.position.set(0, 28, 0);
        scene.add(stationBeamMesh);

        buildWarehouseScene();
        buildGraphVisuals();
        buildFleetMeshes();

        window.addEventListener('resize', onResize);
        renderer.domElement.addEventListener('click', onClick);
        renderer.domElement.addEventListener('mousemove', onMouseMove);

        animate();
    }

    function onResize() {
        const vp = document.getElementById('viewport');
        camera.aspect = vp.clientWidth / vp.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(vp.clientWidth, vp.clientHeight);
    }

    function createPolishedFloorTexture() {
        const c = document.createElement('canvas'); c.width = 1024; c.height = 1024;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#161c26'; ctx.fillRect(0, 0, 1024, 1024);

        ctx.strokeStyle = '#0f141d'; ctx.lineWidth = 3;
        for (let x = 0; x <= 1024; x += 128) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,1024); ctx.stroke(); }
        for (let y = 0; y <= 1024; y += 128) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1024,y); ctx.stroke(); }

        for (let i = 0; i < 7000; i++) {
            const x = Math.random()*1024, y = Math.random()*1024;
            const shade = 26 + Math.random()*22;
            ctx.fillStyle = `rgb(${shade+3},${shade+2},${shade})`;
            ctx.fillRect(x, y, 1+Math.random()*2, 1+Math.random()*2);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(9, 9);
        return tex;
    }

    function buildWarehouseScene() {
        decorGroup = new THREE.Group();
        scene.add(decorGroup);

        // 1. Polished Concrete Ground
        const floorTex = createPolishedFloorTexture();
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(88, 76),
            new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8, metalness: 0.15 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // 2. Low-Profile Perimeter Curb with Hazard Striping
        const curbMat = new THREE.MeshStandardMaterial({ color: 0x141b26, roughness: 0.6 });
        const hazardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4, emissive: 0xfacc15, emissiveIntensity: 0.15 });

        const curbs = [
            { w: 88, h: 0.4, d: 0.4, x: 0, z: -38 },
            { w: 88, h: 0.4, d: 0.4, x: 0, z: 38 },
            { w: 0.4, h: 0.4, d: 76, x: -44, z: 0 },
            { w: 0.4, h: 0.4, d: 76, x: 44, z: 0 }
        ];
        curbs.forEach(b => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), curbMat);
            m.position.set(b.x, 0.2, b.z);
            scene.add(m);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.05, b.d), hazardMat);
            stripe.position.set(b.x, 0.42, b.z);
            scene.add(stripe);
        });

        // Corner Tower Beacons
        [[-44, -38], [44, -38], [-44, 38], [44, 38]].forEach(([cx, cz]) => {
            const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 16),
                new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 }));
            pylon.position.set(cx, 0.6, cz); scene.add(pylon);
            const light = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12),
                new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.8 }));
            light.position.set(cx, 1.3, cz); scene.add(light);
        });

        // 3. Perimeter Pallet Racks (Non-Obstructing Sightlines)
        const racks = [
            { x: -35, z: -18, rx: 9, rz: 2.4, bays: 3 },
            { x: -35, z:  18, rx: 9, rz: 2.4, bays: 3 },
            { x:  35, z: -18, rx: 9, rz: 2.4, bays: 3 },
            { x:  35, z:  18, rx: 9, rz: 2.4, bays: 3 },
            { x: -14, z:  32, rx: 8, rz: 2.2, bays: 3 },
            { x:  14, z:  32, rx: 8, rz: 2.2, bays: 3 },
            { x: -14, z: -32, rx: 8, rz: 2.2, bays: 3 },
            { x:  14, z: -32, rx: 8, rz: 2.2, bays: 3 }
        ];

        const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.4, roughness: 0.4 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.6 });
        const palletMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
        const boxMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
        const drumMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5, metalness: 0.3 });

        racks.forEach(r => {
            const rg = new THREE.Group();
            const shelfH = 0.95;
            const levels = 2;

            for (let i = 0; i <= r.bays; i++) {
                const upright = new THREE.Mesh(new THREE.BoxGeometry(0.12, shelfH * levels + 0.2, 0.12), orangeMat);
                upright.position.set(i * (r.rx / r.bays) - r.rx / 2, (shelfH * levels + 0.2) / 2, 0);
                upright.castShadow = true;
                rg.add(upright);
                const uprightB = upright.clone();
                uprightB.position.z = r.rz;
                rg.add(uprightB);
            }

            for (let lv = 0; lv < levels; lv++) {
                const deck = new THREE.Mesh(new THREE.BoxGeometry(r.rx + 0.2, 0.08, r.rz + 0.1), deckMat);
                deck.position.set(0, (lv + 1) * shelfH - 0.04, r.rz / 2);
                deck.receiveShadow = true;
                rg.add(deck);

                for (let b = 0; b < r.bays; b++) {
                    const bx = b * (r.rx / r.bays) - r.rx / 2 + (r.rx / r.bays) / 2;
                    const by = (lv + 1) * shelfH;
                    const bw = (r.rx / r.bays) * 0.7;
                    const bh = shelfH * 0.55;

                    const pallet = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, r.rz * 0.7), palletMat);
                    pallet.position.set(bx, by + 0.04, r.rz / 2);
                    rg.add(pallet);

                    if ((b + lv) % 2 === 0) {
                        const box = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.85, bh, r.rz * 0.6), boxMat);
                        box.position.set(bx, by + 0.08 + bh / 2, r.rz / 2);
                        box.castShadow = true;
                        rg.add(box);
                    } else {
                        const drum = new THREE.Mesh(new THREE.CylinderGeometry(bw * 0.25, bw * 0.25, bh, 12), drumMat);
                        drum.position.set(bx, by + 0.08 + bh / 2, r.rz / 2);
                        drum.castShadow = true;
                        rg.add(drum);
                    }
                }
            }

            rg.position.set(r.x, 0, r.z);
            decorGroup.add(rg);
            rackGroups.push(rg);
        });

        // 4. Loading Docks & Forklifts in Outer Corners
        buildStaticForklift(-38, 24, decorGroup);
        buildStaticForklift(38, -24, decorGroup);
    }

    function buildStaticForklift(x, z, parentGroup) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 2.2), bodyMat);
        body.position.y = 0.6; body.castShadow = true; g.add(body);
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.0, 0.15), darkMat);
        mast.position.set(0, 1.1, -1.0); g.add(mast);
        [-0.35, 0.35].forEach(fx => {
            const fork = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 1.4), darkMat);
            fork.position.set(fx, 0.15, -1.7); g.add(fork);
        });
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
        [[-0.6, -0.6], [0.6, -0.6], [-0.5, 0.7], [0.5, 0.7]].forEach(([wx, wz]) => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(wx, 0.22, wz); g.add(wheel);
        });
        g.position.set(x, 0, z);
        g.rotation.y = Math.random() * Math.PI;
        parentGroup.add(g);
    }

    /* ═══════════════════════════════════════════
       SECTION 6: 12-STATION PADS & 22 CORRIDORS
       ═══════════════════════════════════════════ */
    function buildGraphVisuals() {
        const padMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.4 });
        const yellowHatchMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.2 });
        const berthMarkerMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 });

        // 1. Station Pads with 5 Multi-Berths Each
        for (let i = 0; i < 12; i++) {
            const s = STATIONS[i];
            const g = new THREE.Group();

            // Safety circle halo
            const hatch = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.4, 32), yellowHatchMat);
            hatch.rotation.x = -Math.PI / 2; hatch.position.y = 0.02;
            g.add(hatch);

            // Dark main pad (clickable destination target)
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.12, 32), padMat);
            pad.position.y = 0.06; pad.receiveShadow = true;
            pad.userData = { type: 'station', stationId: i, stationName: s.label };
            g.add(pad);
            clickableObjects.push(pad);

            // Glowing core ring matching station type
            const ringMat = new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.4 });
            const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.6, 32), ringMat);
            ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13;
            g.add(ring);

            // Painted parking berth outlines on the pad
            BERTH_OFFSETS.forEach(b => {
                const berthMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 2.0), berthMarkerMat);
                berthMesh.position.set(b.dx, 0.14, b.dz);
                g.add(berthMesh);
            });

            // Sleek beacon tower
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8),
                new THREE.MeshStandardMaterial({ color: s.color, metalness: 0.8, roughness: 0.2 }));
            pole.position.set(0, 0.9, 0); g.add(pole);

            // Beacon top light
            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16),
                new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 0.85 }));
            beacon.position.set(0, 1.9, 0); g.add(beacon);

            // Floating station label billboard
            const labelSprite = makeTextSprite(`${i}: ${s.label}`, { fontSize: 18, color: '#f8fafc', bgColor: 'rgba(15,23,42,0.85)' });
            labelSprite.position.set(0, 2.7, 0);
            labelSprite.scale.set(3.6, 1.0, 1);
            g.add(labelSprite);

            g.position.set(s.x, 0, s.z);
            scene.add(g);
            stationMeshes[i] = g;
        }

        // 2. Corridors & Lanes across 22 Edges
        const laneMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.15, roughness: 0.6, transparent: true, opacity: 0.75 });

        EDGES.forEach(([u, v, w]) => {
            const su = STATIONS[u], sv = STATIONS[v];
            const dx = sv.x - su.x, dz = sv.z - su.z;
            const len = Math.sqrt(dx*dx + dz*dz);
            const angle = Math.atan2(dx, dz);
            const mx = (su.x + sv.x) / 2, mz = (su.z + sv.z) / 2;

            // Wide yellow transit lane strip
            const lane = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, len), laneMat.clone());
            lane.position.set(mx, 0.03, mz);
            lane.rotation.y = angle;
            lane.receiveShadow = true;
            scene.add(lane);
            edgeMeshes[`${u}-${v}`] = lane;

            // Dashed center line
            const dashMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.35 });
            const dashCount = Math.max(2, Math.floor(len / 1.6));
            for (let d = 0; d < dashCount; d++) {
                const t = (d + 0.5) / dashCount;
                const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.5), dashMat);
                dash.position.set(su.x + dx * t, 0.04, su.z + dz * t);
                dash.rotation.y = angle;
                scene.add(dash);
            }

            // Clickable weight token
            const tokenMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 });
            const token = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16), tokenMat);
            token.position.set(mx, 0.45, mz);
            token.castShadow = true;
            token.userData = { type: 'edge', u, v, w };
            scene.add(token);
            clickableObjects.push(token);
            edgeLabelMeshes[`${u}-${v}`] = token;

            // Floating cost & meter distance label
            const distMeters = Math.round(w * 9);
            const wSprite = makeTextSprite(`${distMeters}m (w:${w})`, { fontSize: 20, color: '#facc15', bgColor: 'rgba(15,23,42,0.92)' });
            wSprite.position.set(mx, 1.25, mz);
            wSprite.scale.set(1.7, 0.55, 1);
            scene.add(wSprite);
            edgeLabelMeshes[`${u}-${v}-text`] = wSprite;

            // 3D Red Sawhorse Barrier (shown when blocked)
            const barrierGroup = new THREE.Group();
            const barr = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 0.2),
                new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.45 }));
            barr.position.y = 0.75; barrierGroup.add(barr);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.22),
                new THREE.MeshStandardMaterial({ color: 0xffffff }));
            stripe.position.y = 0.75; barrierGroup.add(stripe);
            [-1.0, 1.0].forEach(px => {
                const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8),
                    new THREE.MeshStandardMaterial({ color: 0xef4444 }));
                post.position.set(px, 0.375, 0); barrierGroup.add(post);
            });
            barrierGroup.position.set(mx, 0, mz);
            barrierGroup.rotation.y = angle;
            barrierGroup.visible = false;
            scene.add(barrierGroup);
            edgeBarrierMeshes[`${u}-${v}`] = barrierGroup;
        });
    }

    /* ═══════════════════════════════════════════
       SECTION 7: 3D AGV FLEET MODELS
       ═══════════════════════════════════════════ */
    function buildFleetMeshes() {
        scheduler.robots.forEach(r => {
            const g = new THREE.Group();

            // 1. Industrial Chassis Body
            const bodyMat = new THREE.MeshStandardMaterial({ color: r.colorInt, metalness: 0.5, roughness: 0.3 });
            const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.6), bodyMat);
            body.position.y = 0.55; body.castShadow = true;
            g.add(body);

            // Protective rubber bumper
            const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 2.7),
                new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 }));
            bumper.position.y = 0.4; g.add(bumper);

            // 2. Rotating Rubber Wheels with Silver Rims
            const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 });
            const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
            r.wheels = [];
            [[-0.88, -0.75], [0.88, -0.75], [-0.88, 0.75], [0.88, 0.75]].forEach(([wx, wz]) => {
                const wg = new THREE.Group();
                const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 14), wheelMat);
                tire.rotation.z = Math.PI / 2;
                wg.add(tire);
                const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.15, 8), rimMat);
                rim.rotation.z = Math.PI / 2;
                wg.add(rim);
                wg.position.set(wx, 0.26, wz);
                g.add(wg);
                r.wheels.push(wg);
            });

            // 3. Directional Stencil on Top
            const arrowShape = new THREE.Shape();
            arrowShape.moveTo(0, -0.35); arrowShape.lineTo(0.3, 0.25); arrowShape.lineTo(0, 0.08); arrowShape.lineTo(-0.3, 0.25); arrowShape.closePath();
            const arrow = new THREE.Mesh(new THREE.ExtrudeGeometry(arrowShape, { depth: 0.02, bevelEnabled: false }),
                new THREE.MeshStandardMaterial({ color: 0xffffff }));
            arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.88, -0.2);
            g.add(arrow);

            // 4. Headlights & Volumetric Spotlights
            const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 });
            [-0.55, 0.55].forEach(hx => {
                const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), hlMat);
                hl.position.set(hx, 0.55, -1.35); g.add(hl);
            });
            const headLight = new THREE.SpotLight(0xfff5cc, 0.6, 10, Math.PI / 6, 0.5);
            headLight.position.set(0, 0.65, -1.35); headLight.target.position.set(0, 0, -5);
            g.add(headLight); g.add(headLight.target);
            r.headLight = headLight;

            // 5. Rear Brake Lights
            const tailLights = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.05),
                new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xaa0000, emissiveIntensity: 0.4 }));
            tailLights.position.set(0, 0.55, 1.34); g.add(tailLights);
            r.tailLightMesh = tailLights;

            // 6. Rotating LiDAR Puck & Laser Beam
            const lidarPuck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 16),
                new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 }));
            lidarPuck.position.set(0, 0.96, 0.2); g.add(lidarPuck);

            const laser = new THREE.Mesh(new THREE.ConeGeometry(3.5, 0.05, 16, 1, true, 0, Math.PI / 3),
                new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
            laser.rotation.x = -Math.PI / 2; laser.position.set(0, 0.96, 0.2);
            g.add(laser);
            r.lidarBeam = laser;

            // 7. Emergency Strobe Beacon
            const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12),
                new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 0 }));
            beacon.position.set(0, 1.06, -0.4); g.add(beacon);
            r.beaconMesh = beacon;

            // 8. Dynamic LiDAR Floor Safety Field Ring
            const safetyRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 32),
                new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
            safetyRing.rotation.x = -Math.PI / 2; safetyRing.position.y = 0.03;
            g.add(safetyRing);
            r.safetyRing = safetyRing;

            // 9. Cargo Platform (Pallet + Carton)
            const cargoG = new THREE.Group();
            const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.6),
                new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }));
            pallet.position.y = 0.92; cargoG.add(pallet);
            const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 1.2),
                new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 }));
            box.position.y = 1.28; box.castShadow = true; cargoG.add(box);
            const label = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.01),
                new THREE.MeshStandardMaterial({ color: 0xffffff }));
            label.position.set(0, 1.3, -0.61); cargoG.add(label);
            cargoG.visible = false;
            g.add(cargoG);
            r.cargoMesh = cargoG;

            // 10. Floating High-Visibility Robot Nameplate Sprite
            const idSprite = makeTextSprite(`🤖 ${r.name}`, { fontSize: 22, color: '#ffffff', bgColor: 'rgba(15,23,42,0.95)', borderColor: r.colorHex });
            idSprite.position.set(0, 3.2, 0); idSprite.scale.set(4.2, 1.05, 1);
            g.add(idSprite);
            r.nameSprite = idSprite;

            // Initial Berth Positioning
            const initPos = r.getBerthPosition(r.currentNode, r.berthIndex);
            g.position.set(initPos.x, 0, initPos.z);
            r.pos = { x: initPos.x, z: initPos.z };

            g.userData = { type: 'agv', robotId: r.id };
            scene.add(g);
            body.userData = { type: 'agv', robotId: r.id, group: g };
            clickableObjects.push(body);

            r.mesh = g;
        });
    }

    function makeTextSprite(text, opts = {}) {
        const fontSize = opts.fontSize || 22;
        const color = opts.color || '#ffffff';
        const bgColor = opts.bgColor || 'rgba(15,23,42,0.92)';
        const borderColor = opts.borderColor || 'rgba(255,255,255,0.4)';
        const c = document.createElement('canvas');
        const ctx = c.getContext('2d');
        c.width = 512; c.height = 128;

        // Rounded badge background
        const r = 24;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(8, 8, 512 - 16, 128 - 16, r);
        } else {
            ctx.rect(8, 8, 512 - 16, 128 - 16);
        }
        ctx.fillStyle = bgColor;
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = borderColor;
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = `bold ${fontSize * 1.8}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 64);

        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        return new THREE.Sprite(mat);
    }

    /* ═══════════════════════════════════════════
       SECTION 8: ZERO-COLLISION ANIMATION LOOP
       ═══════════════════════════════════════════ */
    function animate() {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;

        // 1. Dynamic In-Transit Spatial Distance Proximity Check
        for(let i=0; i<scheduler.robots.length; i++){
            for(let j=i+1; j<scheduler.robots.length; j++){
                const rA = scheduler.robots[i], rB = scheduler.robots[j];
                if(rA.mesh && rB.mesh && rA.active && rB.active){
                    const dist = Math.hypot(rA.mesh.position.x - rB.mesh.position.x, rA.mesh.position.z - rB.mesh.position.z);
                    if(dist < 3.2){
                        const pA = rA.task ? rA.task.priority : 0;
                        const pB = rB.task ? rB.task.priority : 0;
                        if(pA >= pB){
                            rB.speedFactor = Math.max(0.0, (dist - 2.5) / 1.0);
                        } else {
                            rA.speedFactor = Math.max(0.0, (dist - 2.5) / 1.0);
                        }
                    } else {
                        rA.speedFactor = 1.0;
                        rB.speedFactor = 1.0;
                    }
                }
            }
        }

        // 2. Interpolate AGVs
        scheduler.robots.forEach(r => {
            if(!r.mesh) return;

            if(r.lidarBeam) r.lidarBeam.rotation.z = time * 8;

            if (r.animProgress < 1 && !r.waiting) {
                const pFrom = STATIONS[r.animFrom];
                const pTo = STATIONS[r.animTo];
                // True physical Euclidean corridor length
                const segDist = Math.max(1, Math.hypot(pTo.x - pFrom.x, pTo.z - pFrom.z));
                // 12.0 meters/second physical cruise velocity
                const speedMps = 12.0 * speedMult * (r.speedFactor !== undefined ? r.speedFactor : 1.0);
                const stepInc = (speedMps * 0.016) / segDist;
                r.animProgress = Math.min(1, r.animProgress + stepInc);

                // Smooth linear translation along the corridor lane
                const s = r.animProgress;
                const nx = pFrom.x + (pTo.x - pFrom.x) * s;
                const nz = pFrom.z + (pTo.z - pFrom.z) * s;
                r.mesh.position.set(nx, 0, nz);
                r.pos = { x: nx, z: nz };

                if(r.wheels && r.speedFactor > 0.05){
                    r.wheels.forEach(w => { w.rotation.x += 0.20 * speedMult; });
                }

                const targetAngle = Math.atan2(pTo.x - pFrom.x, pTo.z - pFrom.z);
                let diff = targetAngle - r.mesh.rotation.y;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                r.mesh.rotation.y += diff * 0.18;
            } else if (isAutoPlaying && r.path.length > 1 && !r.waiting) {
                // Seamlessly advance to the next corridor without halting or teleporting!
                r.currentNode = r.animTo;
                r.animFrom = r.animTo;
                r.animTo = r.path[1];
                r.path.shift();
                r.animProgress = 0;
                r.battery = Math.max(12, r.battery - 0.5);
                logEngine(`${r.name} seamlessly transitioning to corridor ${r.animFrom} ➔ ${r.animTo}`, 'log-step');
                renderFleetCards();
            } else {
                // Reached destination or parked at station berth
                if (r.animTo !== undefined && r.animProgress >= 1) {
                    r.currentNode = r.animTo;
                }
                const berthPos = r.getBerthPosition(r.currentNode, r.berthIndex);
                r.mesh.position.x += (berthPos.x - r.mesh.position.x) * 0.08;
                r.mesh.position.z += (berthPos.z - r.mesh.position.z) * 0.08;
                r.pos = { x: r.mesh.position.x, z: r.mesh.position.z };

                if (r.task && r.animProgress >= 1 && r.path.length <= 1) {
                    logEngine(`🏁 ${r.name} COMPLETED Task ${r.task.id} at ${STATIONS[r.currentNode].label}!`, 'log-step');
                    r.task = null;
                    sfx.chime();
                    renderFleetCards();
                }
            }

            r.cargoMesh.visible = !!r.task;

            // Halo coloring
            if (!r.active) {
                const flash = Math.sin(time * 8) > 0 ? 1 : 0;
                r.beaconMesh.material.emissiveIntensity = flash;
                r.headLight.intensity = 0;
                r.safetyRing.material.color.set(0xef4444);
                r.safetyRing.material.opacity = 0.6;
                r.tailLightMesh.material.emissiveIntensity = 0;
            } else if (r.waiting || (r.speedFactor && r.speedFactor < 0.7)) {
                r.beaconMesh.material.color.set(0xffaa00);
                r.beaconMesh.material.emissive.set(0xffaa00);
                r.beaconMesh.material.emissiveIntensity = Math.sin(time * 5) > 0 ? 0.7 : 0;
                r.headLight.intensity = 0.5;
                r.safetyRing.material.color.set(0xf59e0b);
                r.safetyRing.material.opacity = 0.5;
                r.tailLightMesh.material.emissiveIntensity = 1.0;
            } else {
                r.beaconMesh.material.emissiveIntensity = 0;
                r.beaconMesh.material.color.set(0xff4444);
                r.beaconMesh.material.emissive.set(0xff0000);
                r.headLight.intensity = 0.6;
                r.safetyRing.material.color.set(0x10b981);
                r.safetyRing.material.opacity = 0.35;
                r.tailLightMesh.material.emissiveIntensity = 0.3;
            }
        });

        // 3. Update Blocked Corridor Barriers
        EDGES.forEach(([u, v]) => {
            const key = `${u}-${v}`;
            const blocked = warehouseGraph.isBlocked(u, v);
            const lane = edgeMeshes[key];
            if (lane) {
                lane.material.color.set(blocked ? 0xef4444 : 0xfacc15);
                lane.material.emissive.set(blocked ? 0xef4444 : 0xfacc15);
                lane.material.emissiveIntensity = blocked ? 0.35 : 0.15;
            }
            const barrier = edgeBarrierMeshes[key];
            if (barrier) barrier.visible = blocked;
        });

        // 4. Station Beacons Pulse
        for (let i = 0; i < 12; i++) {
            const g = stationMeshes[i];
            if (g && g.children[4]) {
                g.children[4].material.emissiveIntensity = 0.4 + Math.sin(time * 2 + i) * 0.3;
            }
        }

        // 5. Update Glowing Path Ribbons & Selection Ring
        updateRouteRibbons();

        // 6. Update Robot Selection Ring & 3D Robot Spotlight + Volumetric Beam
        const selR = scheduler.getRobot(selectedRobotId);
        if(selR && selR.mesh){
            const rx = selR.mesh.position.x;
            const rz = selR.mesh.position.z;
            if(robotSelectionRing && robotSelectionRing.visible){
                robotSelectionRing.rotation.z += 0.025;
                robotSelectionRing.position.set(rx, 0.08, rz);
                robotSelectionRing.material.color.set(selR.colorInt);
            }
            if(robotSpotlight){
                robotSpotlight.position.set(rx, 28, rz);
                robotSpotlight.target.position.set(rx, 0.5, rz);
                robotSpotlight.color.set(selR.colorInt);
                robotSpotlight.intensity = 8.5;
            }
            if(robotBeamMesh){
                robotBeamMesh.visible = true;
                robotBeamMesh.position.set(rx, 28, rz);
                robotBeamMesh.material.color.set(selR.colorInt);
                robotBeamMesh.material.opacity = 0.24 + Math.sin(time * 3.5) * 0.05;
            }
        }

        // 7. Update Station Selection Ring & 3D Station Spotlight + Volumetric Beam
        const selSt = STATIONS[selectedStationId];
        if(selSt){
            if(stationSelectionRing && stationSelectionRing.visible){
                stationSelectionRing.rotation.z -= 0.02;
                stationSelectionRing.position.set(selSt.x, 0.09, selSt.z);
                stationSelectionRing.material.color.set(selSt.color);
            }
            if(stationSpotlight){
                stationSpotlight.position.set(selSt.x, 28, selSt.z);
                stationSpotlight.target.position.set(selSt.x, 0.5, selSt.z);
                stationSpotlight.color.set(selSt.color);
                stationSpotlight.intensity = 7.5;
            }
            if(stationBeamMesh){
                stationBeamMesh.visible = true;
                stationBeamMesh.position.set(selSt.x, 28, selSt.z);
                stationBeamMesh.material.color.set(selSt.color);
                stationBeamMesh.material.opacity = 0.22 + Math.cos(time * 3.0) * 0.04;
            }
        }

        updateCameraMovement();
        controls.update();
        renderer.render(scene, camera);
    }

    /* ─── 3D GLOWING PATH RIBBONS & SELECTION INDICATOR ─── */
    function updateRouteRibbons(){
        if(!routeRibbonsGroup){
            routeRibbonsGroup = new THREE.Group();
            scene.add(routeRibbonsGroup);
        }

        // Clear previous ribbons
        while(routeRibbonsGroup.children.length > 0){
            const c = routeRibbonsGroup.children[0];
            routeRibbonsGroup.remove(c);
            if(c.geometry) c.geometry.dispose();
            if(c.material) c.material.dispose();
        }

        // Draw glowing 3D path line for each active robot with a planned route
        scheduler.robots.forEach(r => {
            if(!r.active || !r.mesh) return;

            const pts = [];
            // Current interpolated position
            pts.push(new THREE.Vector3(r.mesh.position.x, 0.12, r.mesh.position.z));

            // If robot is currently in-transit toward animTo, connect to animTo first
            if(r.animProgress < 1 && r.animTo !== undefined && STATIONS[r.animTo]){
                pts.push(new THREE.Vector3(STATIONS[r.animTo].x, 0.12, STATIONS[r.animTo].z));
            }

            // Waypoints through remaining path
            if(r.path && r.path.length > 1){
                for(let i = 1; i < r.path.length; i++){
                    const st = STATIONS[r.path[i]];
                    if(st){
                        pts.push(new THREE.Vector3(st.x, 0.12, st.z));
                    }
                }
            }

            if(pts.length >= 2){
                const curve = new THREE.CatmullRomCurve3(pts);
                const geom = new THREE.TubeGeometry(curve, Math.max(12, pts.length * 6), 0.22, 8, false);
                const mat = new THREE.MeshBasicMaterial({
                    color: r.colorInt,
                    transparent: true,
                    opacity: r.waiting ? 0.35 : 0.75,
                    wireframe: false
                });
                const tube = new THREE.Mesh(geom, mat);
                routeRibbonsGroup.add(tube);

                // Add pulse beacon target ring on destination
                const destNode = r.path[r.path.length - 1];
                const destSt = STATIONS[destNode];
                if(destSt){
                    const destGeom = new THREE.RingGeometry(1.8, 2.2, 24);
                    const destMat = new THREE.MeshBasicMaterial({
                        color: r.colorInt,
                        transparent: true,
                        opacity: 0.65,
                        side: THREE.DoubleSide
                    });
                    const destRing = new THREE.Mesh(destGeom, destMat);
                    destRing.rotation.x = -Math.PI / 2;
                    destRing.position.set(destSt.x, 0.14, destSt.z);
                    routeRibbonsGroup.add(destRing);
                }
            }
        });
    }

    function createSelectionMarker(){
        if(!scene) return;
        if(!robotSelectionRing){
            const geom = new THREE.RingGeometry(2.0, 2.5, 32);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            robotSelectionRing = new THREE.Mesh(geom, mat);
            robotSelectionRing.rotation.x = -Math.PI / 2;
            robotSelectionRing.position.y = 0.08;
            robotSelectionRing.visible = true;
            scene.add(robotSelectionRing);

            const inner = new THREE.Mesh(
                new THREE.RingGeometry(0.3, 0.6, 24),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
            );
            robotSelectionRing.add(inner);
        }

        if(!stationSelectionRing){
            const geom2 = new THREE.RingGeometry(3.0, 3.6, 32);
            const mat2 = new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            stationSelectionRing = new THREE.Mesh(geom2, mat2);
            stationSelectionRing.rotation.x = -Math.PI / 2;
            stationSelectionRing.position.y = 0.09;
            stationSelectionRing.visible = true;
            scene.add(stationSelectionRing);

            const stInner = new THREE.Mesh(
                new THREE.RingGeometry(1.2, 1.5, 24),
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
            );
            stationSelectionRing.add(stInner);
        }
    }

    function setSelectedRobot(rId){
        selectedRobotId = rId;
        const selPlanR = document.getElementById('planRobotSelect');
        if(selPlanR) selPlanR.value = rId;
        const selHudR = document.getElementById('selRobot');
        if(selHudR) selHudR.value = rId;
        const dashR = document.getElementById('dashRobotSelect');
        if(dashR) dashR.value = rId;

        if(!scene || !scheduler) return;
        createSelectionMarker();
        const r = scheduler.getRobot(rId);
        if(r && r.mesh){
            const rx = r.mesh.position.x;
            const rz = r.mesh.position.z;
            if(robotSelectionRing){
                robotSelectionRing.visible = true;
                robotSelectionRing.material.color.set(r.colorInt);
                robotSelectionRing.position.set(rx, 0.08, rz);
            }
            if(robotSpotlight){
                robotSpotlight.position.set(rx, 28, rz);
                robotSpotlight.target.position.set(rx, 0.5, rz);
                robotSpotlight.color.set(r.colorInt);
                robotSpotlight.intensity = 8.5;
            }
            if(robotBeamMesh){
                robotBeamMesh.visible = true;
                robotBeamMesh.position.set(rx, 28, rz);
                robotBeamMesh.material.color.set(r.colorInt);
            }
        }
        updateRouteRibbons();
        updateDashboardShortestPath();
    }

    function setSelectedStation(stId){
        selectedStationId = stId;
        const planDest = document.getElementById('planDestSelect');
        if(planDest) planDest.value = stId;
        const selT = document.getElementById('selTarget');
        if(selT) selT.value = stId;
        const dashT = document.getElementById('dashTargetSelect');
        if(dashT) dashT.value = stId;

        if(!scene) return;
        createSelectionMarker();
        const st = STATIONS[stId];
        if(st){
            if(stationSelectionRing){
                stationSelectionRing.visible = true;
                stationSelectionRing.material.color.set(st.color);
                stationSelectionRing.position.set(st.x, 0.09, st.z);
            }
            if(stationSpotlight){
                stationSpotlight.position.set(st.x, 28, st.z);
                stationSpotlight.target.position.set(st.x, 0.5, st.z);
                stationSpotlight.color.set(st.color);
                stationSpotlight.intensity = 7.5;
            }
            if(stationBeamMesh){
                stationBeamMesh.visible = true;
                stationBeamMesh.position.set(st.x, 28, st.z);
                stationBeamMesh.material.color.set(st.color);
            }
        }
        updateRouteRibbons();
        updateDashboardShortestPath();
    }

    /* ─── CONFLICT TOAST NOTIFICATION BANNER ─── */
    let toastTimeout = null;
    function showConflictToast(type, badgeText, message){
        const toast = document.getElementById('conflict-toast');
        const badge = document.getElementById('toastBadge');
        const msg = document.getElementById('toastMsg');
        if(!toast || !badge || !msg) return;

        toast.className = `show ${type}`;
        badge.textContent = badgeText;
        msg.textContent = message;

        if(toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 5500);
    }

    function updateCameraMovement() {
        if (camMode === 'top') {
            camera.position.lerp(new THREE.Vector3(0, 58, 2), 0.05);
            controls.target.lerp(new THREE.Vector3(0, 0, 2), 0.05);
        } else if (camMode === 'iso') {
            camera.position.lerp(new THREE.Vector3(38, 30, 42), 0.05);
            controls.target.lerp(new THREE.Vector3(0, 0, 2), 0.05);
        } else if (camMode === 'front') {
            camera.position.lerp(new THREE.Vector3(0, 18, 40), 0.05);
            controls.target.lerp(new THREE.Vector3(0, 0, 2), 0.05);
        } else if (camMode.startsWith('agv')) {
            const id = parseInt(camMode.replace('agv', ''));
            const r = scheduler.getRobot(id);
            if (r && r.mesh) {
                const p = r.mesh.position;
                const target = new THREE.Vector3(p.x, 8, p.z + 12);
                camera.position.lerp(target, 0.05);
                controls.target.lerp(new THREE.Vector3(p.x, 0.8, p.z), 0.05);
            }
        }
    }

    /* ═══════════════════════════════════════════
       SECTION 9: RAYCASTING & INTERACTION
       ═══════════════════════════════════════════ */
    function onClick(event) {
        const vp = document.getElementById('viewport');
        const rect = vp.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(clickableObjects, false);

        if (hits.length > 0) {
            const obj = hits[0].object;
            const ud = obj.userData;

            if (ud.type === 'agv') {
                // Select this robot for route assignment
                setSelectedRobot(ud.robotId);
                sfx.click();

                // If user double-clicks or Shift-clicks, toggle fault state
                if (event.shiftKey) {
                    const r = scheduler.getRobot(ud.robotId);
                    if (r.active) scheduler.failRobot(ud.robotId);
                    else scheduler.repairRobot(ud.robotId);
                    renderFleetCards();
                } else {
                    const r = scheduler.getRobot(ud.robotId);
                    showConflictToast("success", "ROBOT SELECTED", `🎯 ${r.name} selected. Click any Station Pad in 3D to assign route!`);
                }
            } else if (ud.type === 'station') {
                const destNode = ud.stationId;
                // Focus spotlight on clicked station immediately
                setSelectedStation(destNode);

                const selPlanR = document.getElementById('planRobotSelect');
                const curRId = selPlanR ? parseInt(selPlanR.value) : selectedRobotId;
                const priority = parseInt(document.getElementById('planPrioritySelect').value || 5);

                // Execute Collision-Guarded Route Assignment!
                scheduler.assignInteractiveCollisionRoute(curRId, destNode, priority);
                startAutoPlayIfNeeded();
                sfx.click();
            } else if (ud.type === 'edge') {
                if (warehouseGraph.isBlocked(ud.u, ud.v)) scheduler.unblockCorridor(ud.u, ud.v);
                else scheduler.blockCorridor(ud.u, ud.v);
                updateRouteRibbons();
                sfx.click();
            }
        }
    }

    function onMouseMove(event) {
        const vp = document.getElementById('viewport');
        const rect = vp.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(clickableObjects, false);

        const tooltip = document.getElementById('robot-tooltip');
        if (hits.length > 0) {
            const ud = hits[0].object.userData;
            if (ud.type === 'agv') {
                const r = scheduler.getRobot(ud.robotId);
                tooltip.style.display = 'block';
                tooltip.style.left = (event.clientX + 15) + 'px';
                tooltip.style.top = (event.clientY - 20) + 'px';
                document.getElementById('tipTitle').textContent = r.name;
                document.getElementById('tipStatus').textContent = r.active ? (r.waiting ? '⚠ YIELDING' : '● NOMINAL') : '✕ FAULT';
                document.getElementById('tipStatus').style.color = r.active ? (r.waiting ? '#fbbf24' : '#10b981') : '#ef4444';
                document.getElementById('tipNode').textContent = `Station ${r.currentNode} [Berth ${r.berthIndex}]`;
                document.getElementById('tipTask').textContent = r.task ? `T${r.task.id} → Node ${r.task.targetNode} [P:${r.task.priority}]` : 'Idle';
                document.getElementById('tipRoute').textContent = r.path.length ? r.path.join('→') : '—';
                document.getElementById('tipSafety').textContent = r.yieldReason || "CLEAR";
                document.getElementById('tipSafety').style.color = r.waiting ? "#fbbf24" : "#34d399";
                document.getElementById('tipBatt').textContent = r.battery + '%';
            } else if (ud.type === 'station') {
                tooltip.style.display = 'block';
                tooltip.style.left = (event.clientX + 15) + 'px';
                tooltip.style.top = (event.clientY - 20) + 'px';
                const st = STATIONS[ud.stationId];
                document.getElementById('tipTitle').textContent = `${st.label} [${st.code}]`;
                document.getElementById('tipStatus').textContent = '📍 3D DESTINATION TARGET';
                document.getElementById('tipStatus').style.color = '#38bdf8';
                document.getElementById('tipNode').textContent = `Station ID: ${ud.stationId}`;
                document.getElementById('tipTask').textContent = `Click to route AGV-${selectedRobotId} here`;
                document.getElementById('tipRoute').textContent = `Type: ${st.type.toUpperCase()}`;
                document.getElementById('tipSafety').textContent = "READY FOR ROUTING";
                document.getElementById('tipSafety').style.color = "#34d399";
                document.getElementById('tipBatt').textContent = '—';
            } else {
                tooltip.style.display = 'none';
            }
        } else {
            tooltip.style.display = 'none';
        }

        renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    }

    /* ═══════════════════════════════════════════
       SECTION 10: SIMULATION INIT & FLEET MANAGER
       ═══════════════════════════════════════════ */
    function startAutoPlayIfNeeded() {
        if (!isAutoPlaying) {
            isAutoPlaying = true;
            const playLbl = document.getElementById('playLabel');
            if (playLbl) playLbl.textContent = 'Pause';
            if (playInterval) clearInterval(playInterval);
            playInterval = setInterval(() => {
                simClock++;
                scheduler.stepSimulation();
                updateClock();
                renderFleetCards();
            }, 1600 / speedMult);
        }
        // Advance 1 tick right away so movement is immediate
        simClock++;
        scheduler.stepSimulation();
        updateClock();
        renderFleetCards();
    }

    function initSimulation() {
        warehouseGraph = new WarehouseGraph(12);
        for (const [u,v,w] of EDGES) warehouseGraph.addEdge(u,v,w);

        scheduler = new CollisionFreeScheduler(warehouseGraph);

        FLEET_CONFIG.forEach(cfg => {
            scheduler.addRobot(cfg.id, cfg.startNode, cfg.hex, cfg.color, cfg.name);
        });

        simClock = 0;
        updateClock();
        renderFleetCards();
        populateDispatchSelects();
    }

    function resetSimulation() {
        if (playInterval) clearInterval(playInterval);
        isAutoPlaying = false;
        document.getElementById('playLabel').textContent = 'Play';

        scheduler.robots.forEach(r => { if (r.mesh) scene.remove(r.mesh); });

        initSimulation();
        buildFleetMeshes();
        setSelectedRobot(selectedRobotId || 101);
        setSelectedStation(selectedStationId || 4);

        EDGES.forEach(([u,v]) => {
            const barrier = edgeBarrierMeshes[`${u}-${v}`];
            if (barrier) barrier.visible = false;
        });

        document.querySelectorAll('.ln').forEach(l => { l.classList.remove('hl'); l.style.opacity = '1'; });
        sfx.click();
    }

    function updateClock() {
        document.getElementById('lblClock').textContent = `T = ${simClock}`;
    }

    function hlLine(id) {
        document.querySelectorAll('.ln').forEach(l => l.classList.remove('hl'));
        const el = document.getElementById(id);
        if (el) { el.classList.add('hl'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }

    function renderFleetCards() {
        const container = document.getElementById('fleetCardsContainer');
        if (!container) return;
        container.innerHTML = '';

        scheduler.robots.forEach(r => {
            const card = document.createElement('div');
            card.className = 'fleet-card';
            card.style.borderLeftColor = r.colorHex;

            let badgeClass = 'badge-active';
            let badgeText = 'NOMINAL';
            if (!r.active) { badgeClass = 'badge-fail'; badgeText = 'FAULT'; }
            else if (r.waiting) { badgeClass = 'badge-yield'; badgeText = 'YIELD'; }
            else if (!r.task) { badgeClass = 'badge-docked'; badgeText = 'IDLE'; }

            card.innerHTML = `
                <div class="fc-head">
                    <span class="fc-name" style="color:${r.colorHex}">${r.name}</span>
                    <span class="fc-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="fc-row">
                    <span>Location:</span>
                    <span class="fc-val">Station ${r.currentNode} [B-${r.berthIndex}]</span>
                </div>
                <div class="fc-row">
                    <span>Order:</span>
                    <span class="fc-val">${r.task ? `T${r.task.id} → Node ${r.task.targetNode} (P:${r.task.priority})` : 'Idle'}</span>
                </div>
                <div class="fc-row">
                    <span>Route:</span>
                    <span class="fc-val">${r.path.length ? r.path.join('→') : '—'}</span>
                </div>
                ${r.yieldReason ? `<div class="fc-row" style="color:#fbbf24;font-size:9.5px;margin-top:3px">⚠️ ${r.yieldReason}</div>` : ''}
            `;
            container.appendChild(card);
        });
    }

    function populateDispatchSelects() {
        const selR = document.getElementById('selRobot');
        const selT = document.getElementById('selTarget');
        const planR = document.getElementById('planRobotSelect');
        const planD = document.getElementById('planDestSelect');

        if(selR) {
            selR.innerHTML = '';
            scheduler.robots.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id; opt.textContent = r.name;
                selR.appendChild(opt);
            });
        }
        if(planR) {
            planR.innerHTML = '';
            scheduler.robots.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id; opt.textContent = r.name;
                if(r.id === selectedRobotId) opt.selected = true;
                planR.appendChild(opt);
            });
        }
        if(selT) {
            selT.innerHTML = '';
            for(let i=0; i<12; i++){
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = `${i}: ${STATIONS[i].label}`;
                if(i===4) opt.selected = true;
                selT.appendChild(opt);
            }
        }
        if(planD) {
            planD.innerHTML = '';
            for(let i=0; i<12; i++){
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = `${i}: ${STATIONS[i].label}`;
                if(i===4) opt.selected = true;
                planD.appendChild(opt);
            }
        }

        // Populate Dashboard modal dropdowns
        const dashR = document.getElementById('dashRobotSelect');
        const dashT = document.getElementById('dashTargetSelect');
        if(dashR) {
            dashR.innerHTML = '';
            scheduler.robots.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id; opt.textContent = `${r.name} (at Station ${r.currentNode})`;
                if(r.id === selectedRobotId) opt.selected = true;
                dashR.appendChild(opt);
            });
        }
        if(dashT) {
            dashT.innerHTML = '';
            for(let i=0; i<12; i++){
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = `${i}: ${STATIONS[i].label} [${STATIONS[i].code}]`;
                if(i===4) opt.selected = true;
                dashT.appendChild(opt);
            }
        }
        updateDashboardShortestPath();
    }

    /* ─── DASHBOARD SHORTEST PATH & DISTANCE IN METERS CALCULATOR ─── */
    function updateDashboardShortestPath() {
        if(!warehouseGraph || !scheduler) return;
        const dashR = document.getElementById('dashRobotSelect');
        const dashT = document.getElementById('dashTargetSelect');
        if(!dashR || !dashT) return;

        const rId = parseInt(dashR.value || selectedRobotId);
        const tgt = parseInt(dashT.value !== undefined ? dashT.value : 4);
        const r = scheduler.getRobot(rId);
        if(!r) return;

        // Update robot info badge
        const badge = document.getElementById('dashSelectedRobotBadge');
        if(badge) badge.textContent = `${r.name} [Priority ${r.task ? r.task.priority : 5}]`;
        const curSt = document.getElementById('dashRobotCurrentStation');
        if(curSt && STATIONS[r.currentNode]) {
            curSt.textContent = `${r.currentNode}: ${STATIONS[r.currentNode].label}`;
        }

        // Update target info
        const tgtSt = STATIONS[tgt];
        if(tgtSt) {
            const coord = document.getElementById('dashTargetCoord');
            if(coord) coord.textContent = `(X: ${tgtSt.x}m, Z: ${tgtSt.z}m)`;
            const stType = document.getElementById('dashStationType');
            if(stType) stType.textContent = tgtSt.type.toUpperCase() + ` [${tgtSt.code}]`;
        }

        // Calculate Dijkstra shortest path & metric distance
        const { path, cost } = warehouseGraph.shortestPath(r.currentNode, tgt);
        const distEl = document.getElementById('dashShortestDistMeters');
        const costEl = document.getElementById('dashGraphCost');
        const timeEl = document.getElementById('dashEstTime');
        const hopsEl = document.getElementById('dashHopsCount');
        const previewBox = document.getElementById('dashPathPreview');
        const riskStatus = document.getElementById('dashRiskStatus');
        const riskDetail = document.getElementById('dashRiskDetail');

        if(cost === -1 || path.length === 0) {
            if(distEl) distEl.textContent = 'Unreachable';
            if(costEl) costEl.textContent = 'Graph Cost: ∞';
            if(timeEl) timeEl.textContent = '—';
            if(hopsEl) hopsEl.textContent = 'No Route';
            if(previewBox) previewBox.innerHTML = '<span style="color:#ef4444">⚠️ No open corridor path connects these hubs</span>';
            if(riskStatus) { riskStatus.textContent = '✕ BLOCKED'; riskStatus.style.color = '#ef4444'; }
            if(riskDetail) riskDetail.textContent = 'All connecting corridors impassable';
            return;
        }

        // Distance in meters: each graph weight unit corresponds to ~9 meters of physical warehouse corridor
        const distMeters = Math.round(cost * 9);
        const estSec = (distMeters / 1.8).toFixed(1);

        if(distEl) distEl.textContent = `${distMeters} m`;
        if(costEl) costEl.textContent = `Graph Dijkstra Cost: ${cost} units`;
        if(timeEl) timeEl.textContent = `${estSec} s`;
        if(hopsEl) hopsEl.textContent = `${path.length} Stations (${path.length - 1} Corridors)`;

        // Render path waypoints preview
        if(previewBox) {
            previewBox.innerHTML = '';
            path.forEach((node, idx) => {
                const pill = document.createElement('span');
                pill.className = 'path-node-pill';
                const st = STATIONS[node];
                pill.textContent = `${node}: ${st ? st.code : 'Node'}`;
                if(idx === 0) {
                    pill.style.borderColor = r.colorHex;
                    pill.style.color = r.colorHex;
                } else if(idx === path.length - 1) {
                    pill.style.borderColor = '#10b981';
                    pill.style.color = '#34d399';
                }
                previewBox.appendChild(pill);

                if(idx < path.length - 1) {
                    const arrow = document.createElement('span');
                    arrow.style.color = 'var(--accent)';
                    arrow.textContent = '➔';
                    previewBox.appendChild(arrow);
                }
            });
        }

        // Pre-evaluate collision risk against other active robots
        let hasConflict = false;
        let conflictWith = null;
        for(const other of scheduler.robots) {
            if(other.id === r.id || !other.active || other.path.length <= 1) continue;
            if(r.currentNode === other.path[1] && path[1] === other.currentNode) {
                hasConflict = true; conflictWith = other; break;
            }
            if(path[1] === other.path[1]) {
                hasConflict = true; conflictWith = other; break;
            }
        }

        if(riskStatus && riskDetail) {
            if(hasConflict) {
                riskStatus.textContent = `⚠ TRAFFIC CONFLICT`;
                riskStatus.style.color = '#facc15';
                riskDetail.textContent = `Interlock with ${conflictWith.name} will auto-reroute via bypass`;
            } else {
                riskStatus.textContent = `● 100% CLEAR`;
                riskStatus.style.color = '#34d399';
                riskDetail.textContent = `Zero collision risk across all ${path.length-1} corridors`;
            }
        }
    }

    function setScenarioActive(idx) {
        activeScenarioIndex = idx;
        document.querySelectorAll('.scen-btn').forEach((b, i) => {
            b.classList.toggle('active', (i + 1) === idx);
        });
    }

    /* ═══════════════════════════════════════════
       SECTION 11: 7 EXTENSIVE SCENARIOS
       ═══════════════════════════════════════════ */

    // SCENARIO 1: Canonical C++ Baseline (Exact 3-stage replay)
    
    /* ═══════════════════════════════════════════
       CANONICAL C++ PROGRAM DEMO SESSION CONTROLLER
       ═══════════════════════════════════════════ */
    let cppDemoState = {
        active: false,
        currentStage: 1,
        autoPlayTimer: null,
        isPaused: false
    };

    const CPP_DEMO_STAGES = [
        {
            stage: 1,
            badge: "STAGE 1 / 3: BASELINE RUN & DIJKSTRA DISPATCH",
            narrative: "main.cpp (Lines 170-175): Initializing 6-node warehouse graph with 8 corridors. Scheduler dispatches Robot 101 with Task 1 (Target: Node 4, Priority 5) -> Dijkstra finds shortest route [0 ➔ 1 ➔ 4], cost=7. Scheduler dispatches Robot 102 with Task 2 (Target: Node 4, Priority 2) -> Dijkstra finds shortest route [5 ➔ 4], cost=3. Both AGVs travel smoothly along their corridors with spotlights tracking them.",
            lines: ['c1', 'c2', 'c3', 'c4', 'c5'],
            async action() {
                resetSimulation();
                showTab('console');
                openCppPanelIfNeeded();
                hlLine('c1');
                await wait(600);
                const t1 = new Task(1, 4, 5), t2 = new Task(2, 4, 2);
                scheduler.assignTask(101, t1);
                hlLine('c2');
                await wait(800);
                scheduler.assignTask(102, t2);
                hlLine('c3');
                await wait(800);
                scheduler.resolveConflicts();
                renderFleetCards();
                await wait(1000);
                scheduler.stepSimulation();
                hlLine('c4');
                await wait(600);
                hlLine('c5');
                simClock++; updateClock(); renderFleetCards();
                sfx.chime();
            }
        },
        {
            stage: 2,
            badge: "STAGE 2 / 3: DYNAMIC MID-RUN CORRIDOR BLOCKADE",
            narrative: "main.cpp (Lines 176-179): Corridor 3-4 blocked mid-run (edge weight set to INT_MAX). Dynamic Dijkstra recalculates alternate paths in real time. Visual hazard barrier active. Robot 101 at Node 1 dynamically reroutes via direct bypass edge 1 ➔ 4 (cost=5) and travels smoothly to Shipping Bay A.",
            lines: ['c6', 'c7', 'c8', 'c9', 'c10'],
            async action() {
                openCppPanelIfNeeded();
                showTab('console');
                hlLine('c6');
                await wait(600);
                scheduler.blockCorridor(3, 4);
                hlLine('c7');
                await wait(700);
                hlLine('c8');
                await wait(700);
                hlLine('c9');
                await wait(1000);
                scheduler.stepSimulation();
                hlLine('c10');
                simClock++; updateClock(); renderFleetCards();
                sfx.alert();
            }
        },
        {
            stage: 3,
            badge: "STAGE 3 / 3: MID-RUN ROBOT FAILURE & SAFE LOCKOUT",
            narrative: "main.cpp (Lines 180-183): Robot 102 experiences emergency mechanical/motor fault. Active status disabled; red strobe hazard beacon flashes; safety lockout engaged. Scheduler isolates failed AGV from collision graph. System maintains zero collisions while fleet continues operations.",
            lines: ['c11', 'c12'],
            async action() {
                openCppPanelIfNeeded();
                showTab('console');
                hlLine('c11');
                await wait(700);
                scheduler.failRobot(102);
                hlLine('c12');
                await wait(1000);
                scheduler.stepSimulation();
                simClock++; updateClock(); renderFleetCards();
                sfx.alert();
            }
        }
    ];

    function openCppPanelIfNeeded() {
        const panel = document.getElementById('cpp-panel');
        if (panel && panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            const toggle = document.getElementById('panel-toggle');
            if (toggle) toggle.textContent = '◀';
            setTimeout(onResize, 350);
        }
    }

    async function startCppDemoSession(targetStage = 1) {
        cppDemoState.active = true;
        cppDemoState.currentStage = targetStage;
        cppDemoState.isPaused = false;

        const banner = document.getElementById('cpp-demo-banner');
        if (banner) banner.style.display = 'flex';

        const btnPlayPause = document.getElementById('demoBtnPlayPause');
        if (btnPlayPause) btnPlayPause.textContent = '⏸ Pause';

        setScenarioActive(1);
        await executeDemoStage(targetStage);
    }

    async function executeDemoStage(stageNum) {
        if (!cppDemoState.active) return;
        cppDemoState.currentStage = stageNum;
        const stageData = CPP_DEMO_STAGES[stageNum - 1];
        if (!stageData) return;

        const pill = document.getElementById('demoStagePill');
        if (pill) pill.textContent = stageData.badge;

        const narrative = document.getElementById('demoNarrative');
        if (narrative) narrative.textContent = stageData.narrative;

        // Execute stage action
        await stageData.action();

        // If auto-play is not paused, schedule transition to next stage
        if (!cppDemoState.isPaused && stageNum < CPP_DEMO_STAGES.length) {
            clearTimeout(cppDemoState.autoPlayTimer);
            cppDemoState.autoPlayTimer = setTimeout(() => {
                if (cppDemoState.active && !cppDemoState.isPaused) {
                    executeDemoStage(stageNum + 1);
                }
            }, 4500 / speedMult);
        }
    }

    function closeCppDemoSession() {
        cppDemoState.active = false;
        clearTimeout(cppDemoState.autoPlayTimer);
        const banner = document.getElementById('cpp-demo-banner');
        if (banner) banner.style.display = 'none';
    }

    const wait = ms => new Promise(r => setTimeout(r, ms / speedMult));

    async function runScenario1() {
        setScenarioActive(1);
        resetSimulation();
        showTab('console');
        const wait = ms => new Promise(r => setTimeout(r, ms / speedMult));

        logEngine('--- SCENARIO 1: CANONICAL C++ BASELINE REPLAY ---', 'log-dijkstra');
        hlLine('c1'); await wait(600);
        const t1 = new Task(1, 4, 5), t2 = new Task(2, 4, 2);
        scheduler.assignTask(101, t1);
        hlLine('c2'); await wait(800);
        scheduler.assignTask(102, t2);
        hlLine('c3'); await wait(800);

        scheduler.resolveConflicts();
        renderFleetCards();
        await wait(1200);

        scheduler.stepSimulation();
        hlLine('c4'); await wait(500);
        hlLine('c5');
        simClock++; updateClock(); renderFleetCards();

        // Stage 2
        await wait(2200);
        hlLine('c6'); await wait(500);
        scheduler.blockCorridor(3, 4);
        hlLine('c7'); await wait(600);
        hlLine('c8'); await wait(600);
        hlLine('c9'); await wait(1400);

        scheduler.stepSimulation();
        hlLine('c10');
        simClock++; updateClock(); renderFleetCards();

        // Stage 3
        await wait(2200);
        hlLine('c11'); await wait(600);
        scheduler.failRobot(102);
        hlLine('c12'); await wait(1200);

        scheduler.stepSimulation();
        simClock++; updateClock(); renderFleetCards();
        sfx.chime();
    }

    // SCENARIO 2: Multi-AGV Cross-Docking (All 5 AGVs)
    function runScenario2() {
        setScenarioActive(2);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 2: FULL 5-AGV CROSS-DOCKING FLEET ---', 'log-dijkstra');

        scheduler.assignTask(101, new Task(201, 4, 5)); // Dock A -> Shipping A
        scheduler.assignTask(102, new Task(202, 9, 2)); // Storage -> Shipping B
        scheduler.assignTask(103, new Task(203, 3, 4)); // Dock B -> Packing Line A
        scheduler.assignTask(104, new Task(204, 1, 3)); // Deep Storage -> North Sortation
        scheduler.assignTask(105, new Task(205, 8, 6)); // Inspection -> Packing Line B

        scheduler.resolveConflicts();
        renderFleetCards();
        sfx.chime();
    }

    // SCENARIO 3: Cascading Corridor Blockade
    function runScenario3() {
        setScenarioActive(3);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 3: DUAL-CORRIDOR CASCADING BLOCKADE ---', 'log-reroute');

        // Assign tasks targeting Shipping Hubs
        scheduler.assignTask(101, new Task(301, 4, 5));
        scheduler.assignTask(102, new Task(302, 4, 2));
        scheduler.assignTask(103, new Task(303, 9, 4));

        renderFleetCards();

        setTimeout(() => {
            // Block corridor 3-4 AND corridor 1-4 simultaneously!
            scheduler.blockCorridor(3, 4);
            scheduler.blockCorridor(1, 4);
            scheduler.resolveConflicts();
            renderFleetCards();
            sfx.alert();
        }, 1200);
    }

    // SCENARIO 4: High-Value Rush Priority Express Override
    function runScenario4() {
        setScenarioActive(4);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 4: RUSH PRIORITY 99 OVERRIDE ---', 'log-conflict');

        // AGV-101 at Dock A with standard task
        scheduler.assignTask(101, new Task(401, 8, 3));
        scheduler.assignTask(102, new Task(402, 3, 2));
        scheduler.assignTask(103, new Task(403, 2, 4));

        // AGV-105 assigned Critical Rush Priority 99 Medical Order!
        scheduler.assignTask(105, new Task(999, 4, 99));

        scheduler.resolveConflicts();
        renderFleetCards();
        sfx.chime();
    }

    // SCENARIO 5: Head-to-Head Aisle Deadlock Resolution
    function runScenario5() {
        setScenarioActive(5);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 5: HEAD-TO-HEAD NARROW AISLE ARBITRATION ---', 'log-conflict');

        // Place AGV-101 at Station 1 and AGV-103 at Station 2
        const r101 = scheduler.getRobot(101);
        const r103 = scheduler.getRobot(103);
        r101.currentNode = 1; r101.mesh.position.set(STATIONS[1].x, 0, STATIONS[1].z);
        r103.currentNode = 2; r103.mesh.position.set(STATIONS[2].x, 0, STATIONS[2].z);

        // Opposite trajectories: AGV-101 wants 1->2->4, AGV-103 wants 2->1->6
        scheduler.assignTask(101, new Task(501, 4, 8)); // Higher Priority 8
        scheduler.assignTask(103, new Task(502, 6, 3)); // Lower Priority 3

        scheduler.resolveConflicts();
        renderFleetCards();
        sfx.yieldWarn();
    }

    // SCENARIO 6: Dual AGV Mechanical Fault Isolation
    function runScenario6() {
        setScenarioActive(6);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 6: DUAL MOTOR FAULT ISOLATION ---', 'log-fault');

        scheduler.assignTask(101, new Task(601, 4, 5));
        scheduler.assignTask(103, new Task(603, 9, 4));
        scheduler.assignTask(105, new Task(605, 8, 6));

        // Fail AGV-102 and AGV-104 at strategic junctions
        scheduler.failRobot(102);
        scheduler.failRobot(104);

        scheduler.resolveConflicts();
        renderFleetCards();
        sfx.alert();
    }

    // SCENARIO 7: 24/7 Autonomous Logistics Swarm Loop
    function runScenario7() {
        setScenarioActive(7);
        resetSimulation();
        showTab('livelog');
        logEngine('--- SCENARIO 7: 24/7 AUTONOMOUS LOGISTICS SWARM LOOP ---', 'log-step');
        sfx.chime();

        let taskIdCounter = 700;
        scheduler.robots.forEach(r => {
            const tgt = (r.currentNode + 3 + Math.floor(Math.random() * 6)) % 12;
            const p = Math.floor(2 + Math.random() * 7);
            scheduler.assignTask(r.id, new Task(taskIdCounter++, tgt, p));
        });

        renderFleetCards();

        isAutoPlaying = true;
        document.getElementById('playLabel').textContent = 'Pause';
        if (playInterval) clearInterval(playInterval);

        playInterval = setInterval(() => {
            simClock++;
            scheduler.stepSimulation();
            updateClock();
            renderFleetCards();

            // Auto-replenish orders for idle robots
            scheduler.robots.forEach(r => {
                if (r.active && r.path.length <= 1) {
                    let newTarget;
                    do {
                        newTarget = Math.floor(Math.random() * 12);
                    } while (newTarget === r.currentNode);
                    const p = Math.floor(1 + Math.random() * 8);
                    scheduler.assignTask(r.id, new Task(taskIdCounter++, newTarget, p));
                }
            });
        }, 1600 / speedMult);
    }

    /* ═══════════════════════════════════════════
       SECTION 12: UI EVENT BINDINGS
       ═══════════════════════════════════════════ */
    window.addEventListener('load', () => {
        initSimulation();
        initThree();
        setSelectedRobot(101);
        setSelectedStation(4);

        // 1. C++ Demo Replay Button
        document.getElementById('btnReplay').addEventListener('click', runScenario1);

        // 2. Autonomous Multi-AGV Mode Button
        document.getElementById('btnFleetDispatch').addEventListener('click', runScenario7);

        // 3. Play / Pause
        document.getElementById('btnPlay').addEventListener('click', () => {
            isAutoPlaying = !isAutoPlaying;
            document.getElementById('playLabel').textContent = isAutoPlaying ? 'Pause' : 'Play';
            if (isAutoPlaying) {
                playInterval = setInterval(() => {
                    simClock++;
                    scheduler.stepSimulation();
                    updateClock();
                    renderFleetCards();
                }, 1600 / speedMult);
            } else {
                clearInterval(playInterval);
            }
        });

        // 4. Step Simulation
        document.getElementById('btnStep').addEventListener('click', () => {
            simClock++;
            scheduler.stepSimulation();
            updateClock();
            renderFleetCards();
        });

        // 5. Reset
        document.getElementById('btnReset').addEventListener('click', resetSimulation);

        // 6. Speed Slider
        document.getElementById('speedSlider').addEventListener('input', e => {
            speedMult = parseFloat(e.target.value);
            document.getElementById('lblSpeed').textContent = speedMult.toFixed(2) + 'x';
            if (isAutoPlaying) {
                clearInterval(playInterval);
                playInterval = setInterval(() => {
                    simClock++;
                    scheduler.stepSimulation();
                    updateClock();
                    renderFleetCards();
                }, 1600 / speedMult);
            }
        });

        // 7. Audio Toggle
        document.getElementById('btnAudio').addEventListener('click', function() {
            sfx.enabled = !sfx.enabled;
            this.textContent = sfx.enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
            if (sfx.enabled) sfx.tone(600, 'sine', 0.1);
        });

        // 8. Obstacles Toggle
        document.getElementById('btnDecor').addEventListener('click', function() {
            decorVisible = !decorVisible;
            if (decorGroup) decorGroup.visible = decorVisible;
            this.textContent = decorVisible ? '📦 Obstacles: ON' : '📦 Obstacles: OFF';
            sfx.click();
        });

        // 9. Scenarios Drawer Toggle
        document.getElementById('btnScenarios').addEventListener('click', () => {
            document.getElementById('left-hud').classList.toggle('collapsed');
        });
        document.getElementById('closeHud').addEventListener('click', () => {
            document.getElementById('left-hud').classList.add('collapsed');
        });

        // 10. Custom Task Dispatch in Left Drawer (Uses Zero-Collision Route Guard)
        document.getElementById('btnDispatchCustom').addEventListener('click', () => {
            const rId = parseInt(document.getElementById('selRobot').value);
            const target = parseInt(document.getElementById('selTarget').value);
            const priority = parseInt(document.getElementById('selPriority').value);
            scheduler.assignInteractiveCollisionRoute(rId, target, priority);
            startAutoPlayIfNeeded();
            sfx.click();
        });

        // 11. Top Interactive Route Planner Bar Controls
        document.getElementById('planRobotSelect').addEventListener('change', e => {
            setSelectedRobot(parseInt(e.target.value));
            sfx.click();
        });

        document.getElementById('planDestSelect').addEventListener('change', e => {
            setSelectedStation(parseInt(e.target.value));
            sfx.click();
        });

        document.getElementById('btnPlanRoute').addEventListener('click', () => {
            const rId = parseInt(document.getElementById('planRobotSelect').value);
            const target = parseInt(document.getElementById('planDestSelect').value);
            const priority = parseInt(document.getElementById('planPrioritySelect').value);
            scheduler.assignInteractiveCollisionRoute(rId, target, priority);
            startAutoPlayIfNeeded();
            sfx.click();
        });

        // 12. 3D Click-to-Route Mode Toggle
        const toggleClickBtn = document.getElementById('toggleClickToRoute');
        toggleClickBtn.classList.add('active'); // Enabled by default!
        document.getElementById('clickRouteLabel').textContent = '3D Click: ON';
        toggleClickBtn.addEventListener('click', () => {
            clickToRouteMode = !clickToRouteMode;
            toggleClickBtn.classList.toggle('active', clickToRouteMode);
            document.getElementById('clickRouteLabel').textContent = clickToRouteMode ? '3D Click: ON' : '3D Click: OFF';
            if(clickToRouteMode){
                showConflictToast("success", "3D CLICK ACTIVE", "🖱️ Click any AGV in 3D, then click any Station Pad to assign a route!");
            }
            sfx.click();
        });

        // 13. Interactive Dispatch & Distance Dashboard Modal Event Wiring
        const dashModal = document.getElementById('dispatch-dashboard-modal');
        document.getElementById('btnOpenDashboard').addEventListener('click', () => {
            dashModal.classList.add('active');
            updateDashboardShortestPath();
            sfx.chime();
        });
        document.getElementById('btnCloseDashboard').addEventListener('click', () => {
            dashModal.classList.remove('active');
            sfx.click();
        });
        dashModal.addEventListener('click', e => {
            if(e.target === dashModal) {
                dashModal.classList.remove('active');
                sfx.click();
            }
        });

        document.getElementById('dashRobotSelect').addEventListener('change', e => {
            setSelectedRobot(parseInt(e.target.value));
            sfx.click();
        });
        document.getElementById('dashTargetSelect').addEventListener('change', e => {
            setSelectedStation(parseInt(e.target.value));
            sfx.click();
        });

        document.getElementById('dashBtnExecute').addEventListener('click', () => {
            const rId = parseInt(document.getElementById('dashRobotSelect').value);
            const target = parseInt(document.getElementById('dashTargetSelect').value);
            const priority = parseInt(document.getElementById('dashPrioritySelect').value);
            scheduler.assignInteractiveCollisionRoute(rId, target, priority);
            startAutoPlayIfNeeded();
            dashModal.classList.remove('active');
            sfx.click();
        });

        // Scenarios 1 to 7 bindings
        document.getElementById('btnScen1').addEventListener('click', runScenario1);
        document.getElementById('btnScen2').addEventListener('click', runScenario2);
        document.getElementById('btnScen3').addEventListener('click', runScenario3);
        document.getElementById('btnScen4').addEventListener('click', runScenario4);
        document.getElementById('btnScen5').addEventListener('click', runScenario5);
        document.getElementById('btnScen6').addEventListener('click', runScenario6);
        document.getElementById('btnScen7').addEventListener('click', runScenario7);

        // Camera Modes
        document.querySelectorAll('.cam-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                camMode = btn.dataset.cam;
                document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                controls.enabled = (camMode === 'orbit');
                if (camMode !== 'orbit') controls.enabled = true;
                sfx.click();
            });
        });

        // Toggle C++ Panel
        document.getElementById('panel-toggle').addEventListener('click', () => {
            const panel = document.getElementById('cpp-panel');
            panel.classList.toggle('collapsed');
            document.getElementById('panel-toggle').textContent = panel.classList.contains('collapsed') ? '▶' : '◀';
            setTimeout(onResize, 350);
        });

        // Tab Switching
        window.showTab = function(tab) {
            document.getElementById('tabConsole').classList.toggle('active', tab === 'console');
            document.getElementById('tabLiveLog').classList.toggle('active', tab === 'livelog');
            document.getElementById('tabCode').classList.toggle('active', tab === 'code');
            document.getElementById('cpp-console').style.display = tab === 'console' ? 'flex' : 'none';
            document.getElementById('cpp-live-log').style.display = tab === 'livelog' ? 'flex' : 'none';
            document.getElementById('cpp-code').style.display = tab === 'code' ? 'block' : 'none';
        };

        // Copy C++ Output
        document.getElementById('btnCopy').addEventListener('click', () => {
            const t = `----- Baseline run -----\nRobot 101 assigned Task 1 -> cost = 7, route: 0 -> 1 -> 4\nRobot 102 assigned Task 2 -> cost = 3, route: 5 -> 4\nRobot 101 moved to node 1\nRobot 102 moved to node 4\n\n----- Corridor blocked mid-run -----\nCorridor 3-4 blocked. Rerouting affected robots...\nRobot 101 rerouted, new cost = 5\nRobot 102 rerouted, new cost = 0\nRobot 101 moved to node 4\n\n----- Robot failure mid-run -----\nRobot 102 has FAILED.`;
            navigator.clipboard.writeText(t).then(() => alert('C++ Output copied!'));
        });

        // Clear C++ Highlights
        document.getElementById('btnClear').addEventListener('click', () => {
            document.querySelectorAll('.ln').forEach(l => l.style.opacity = '0.3');
        });
    });
