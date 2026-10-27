# 3D Autonomous Warehouse AGV Fleet & Multi-Route Dijkstra Routing

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-success?style=for-the-badge&logo=vercel)](https://warehousedeployment.vercel.app)
[![C++17](https://img.shields.io/badge/C++-17-blue.svg?style=for-the-badge&logo=c%2B%2B)](main.cpp)
[![Three.js](https://img.shields.io/badge/Three.js-r128-black?style=for-the-badge&logo=three.js)](https://threejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

An interactive, industrial-grade 3D logistics simulation of autonomous guided vehicles (AGVs) operating in a 12-hub warehouse across 32 transit corridors. Features real-time Dijkstra shortest-path routing, zero-collision lookahead arbitration, dynamic obstacle avoidance, and a canonical C++ verification replay session mirroring `main.cpp`.

🔗 **Live Deployment:** [https://warehousedeployment.vercel.app](https://warehousedeployment.vercel.app)  
👤 **Author:** [Preetham Singh (@algoreetham)](https://github.com/algoreetham)

---

## 🌟 Key Features

* **3D Fleet Simulation (Three.js)**: 5 active industrial AGVs (Alpha, Beta, Gamma, Delta, Echo) with rotating LiDAR beams, directional headlights, dynamic safety halos, and physical wheel rotation.
* **12 Warehouse Hubs & 32 Transit Corridors**: Fully connected industrial logistics grid covering Inbound Docks, Sorting, Storage, Quality Inspection, Packing Lines, and Shipping Bays.
* **Dijkstra Shortest Path Engine**: Real-time graph routing with dynamically weighted edges and obstacle invalidation (((V+E)\log V)$).
* **Zero-Collision Lookahead Arbitration**: Proactive conflict detection at downstream junctions and narrow aisles, priority-based right-of-way assignment, and dynamic yielding/rerouting.
* **Dynamic Corridor Failure & Rerouting**: Real-time corridor blockage (cost = $\infty$) triggers instant alternate bypass discovery across the fleet with physical hazard barrier deployment.
* **Fault Isolation**: Simulates mechanical AGV motor failures with automatic safety lockout, red hazard beacons, and dynamic obstacle reclassification.
* **Interactive Route Planner & 3D Click-to-Route**: Select any AGV, pick a destination, and dispatch with collision guards directly in 3D.
* **Canonical C++ Presentation Demo Session**: A built-in presentation overlay that guides examiners and audiences through the canonical 3-stage execution of `main.cpp` with line-by-line terminal echo and code highlights.

---

## 🏗️ Warehouse Layout (12 Stations & 32 Corridors)

| Node ID | Code | Station Name | Zone Type | Coordinates (X, Z) |
|:---:|:---:|:---|:---:|:---:|
| **0** | DOCK-0A | Inbound Dock A | Dock | (-25m, 6m) |
| **1** | SORT-01 | North Sortation | Sorting | (-8m, -12m) |
| **2** | HUB-02 | Central Crossway | Hub | (-2m, 10m) |
| **3** | PACK-0A | Packing Line A | Packing | (14m, -12m) |
| **4** | SHIP-0A | Shipping Bay A | Shipping | (26m, 8m) |
| **5** | STG-05 | Pallet Storage | Storage | (-14m, 22m) |
| **6** | DOCK-0B | Inbound Dock B | Dock | (-25m, -8m) |
| **7** | QC-07 | Quality Inspection | Hub | (0m, -2m) |
| **8** | PACK-0B | Packing Line B | Packing | (14m, 8m) |
| **9** | SHIP-0B | Shipping Bay B | Shipping | (26m, -8m) |
| **10** | COLD-10 | Deep Cold Storage | Storage | (2m, 24m) |
| **11** | CHG-11 | Charging Depot | Depot | (3m, -24m) |

---

## 🤖 AGV Fleet Specifications

| AGV ID | Name | Color | Start Node | Default Priority |
|:---:|:---|:---:|:---:|:---:|
| **101** | AGV-101 (Alpha) | Amber (#f59e0b) | Station 0 (Inbound Dock A) | P5 (Priority Order) |
| **102** | AGV-102 (Beta) | Blue (#0284c7) | Station 5 (Pallet Storage) | P2 (Standard Routine) |
| **103** | AGV-103 (Gamma) | Green (#10b981) | Station 6 (Inbound Dock B) | P4 (Restock) |
| **104** | AGV-104 (Delta) | Red (#ef4444) | Station 10 (Deep Storage) | P3 (Sorting) |
| **105** | AGV-105 (Echo) | Purple (#a855f7) | Station 7 (Quality Inspect) | P6 (Express Cargo) |

---

## 📋 7 Pre-Configured Simulation Demonstrations

1. **Canonical C++ Baseline**: Exact 3-stage replay matching `main.cpp` with line-by-line terminal echo and code highlights.
2. **Multi-AGV Cross-Docking**: All 5 AGVs dispatch simultaneously across Docks, Storage, Sortation, Packing, and Shipping with zero collisions.
3. **Cascading Corridor Blockade**: Simultaneous blockage on main corridors (3–4 and 1–4). Entire fleet dynamically detours around hazards.
4. **Rush Express Priority Override**: AGV-105 is assigned Priority 99 Emergency Task. Other 4 AGVs pull into side berths, yield, and clear express right-of-way.
5. **Head-to-Head Aisle Deadlock**: AGVs enter same narrow corridor from opposite directions. Interlock halts lower priority and commands bypass.
6. **Dual Motor Fault Isolation**: AGV-102 and AGV-104 fail mid-transit. Hazard beacons engage; fleet treats them as static barriers and reroutes.
7. **24/7 Autonomous Logistics Swarm**: Continuous autonomous warehouse operations with automatic task regeneration.

---

## 📁 Repository Structure

```
.
├── index.html                  # Main production simulation entry point
├── warehouse_simulation.html   # Standalone copy of 3D simulation
├── main.cpp                    # Canonical C++ Dijkstra & Scheduling implementation
├── vercel.json                 # Vercel cloud deployment configuration
└── README.md                   # Project documentation
```

---

## 🚀 Running Locally

Open `index.html` directly in any modern web browser, or launch a local server:

```bash
# Python 3
python3 -m http.server 3000

# Node.js
npx serve .
```

Navigate to `http://localhost:3000`.

---

## 🎓 C++ Reference Code (`main.cpp`)

Compile and execute the canonical C++ benchmark:

```bash
g++ -std=c++17 main.cpp -o main
./main
```

### Canonical Execution Stages:
* **Stage 1 (Baseline Run)**: Dispatches Robot 101 (`0 ➔ 1 ➔ 4`, cost=7) and Robot 102 (`5 ➔ 4`, cost=3) using Dijkstra shortest paths.
* **Stage 2 (Corridor Blocked Mid-Run)**: Dynamically blocks corridor 3–4 (cost = $\infty$) and reroutes affected AGVs via bypass edge `1 ➔ 4` in real time.
* **Stage 3 (Robot Failure Mid-Run)**: Simulates motor failure on Robot 102 and isolates the unit with safe lockout.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
