// v13+ FilePicker namespaced under foundry.applications.apps.
const FilePicker = foundry.applications.apps.FilePicker?.implementation ?? globalThis.FilePicker;

/**
 * MaphubViewerApp.mjs
 * ApplicationV2 window that displays a settlement map in an iframe.
 * The iframe is created entirely via DOM (not via HTML string / innerHTML) so
 * that sandbox="allow-same-origin" is never stripped by FoundryVTT's journal
 * HTML sanitizer.
 *
 * For local maphub: serves index.html directly from the module's static path.
 * express.static does NOT add X-Frame-Options, so the iframe loads fine.
 * Using a server URL (not a blob:) also keeps relative asset paths inside
 * Village.js (Assets/village_default.json, etc.) resolving correctly.
 *
 * For external fallback: uses the watabou.github.io URL directly.
 */

import { OnePageParserSD } from "./maphub/OnePageParserSD.mjs";

const MODULE_ID = "shadowdark-extras";
const { ApplicationV2 } = foundry.applications.api;

export class MaphubViewerApp extends ApplicationV2 {

	/** @param {{ type: string, queryString: string, externalBase: string }} options */
	constructor({ type, queryString = "", externalBase = "" } = {}) {
		super({});
		this._mapType = type;
		this._queryString = queryString;
		this._externalBase = externalBase;
		this._lastSavedDungeonJson = null;
		this._lastSavedDungeonJsonAt = 0;
		this._saveRotationWasOn = false;

		this._onMessage = this._onMessage.bind(this);
	}

	static DEFAULT_OPTIONS = {
		id: "sdx-maphub-viewer",
		classes: ["sdx-maphub-viewer"],
		tag: "div",
		window: {
			frame: true,
			positioned: true,
			title: "Settlement Map",
			resizable: true,
		},
		position: {
			width: 900,
			height: 660,
			top: 60,
		},
		actions: {
			exportToChat: MaphubViewerApp.#onExportToChat,
			showToPlayers: MaphubViewerApp.#onShowToPlayers,
			saveMapState: MaphubViewerApp.#onSaveMapState,
			importScene: MaphubViewerApp.#onImportScene,
			setAsBackground: MaphubViewerApp.#onSetAsBackground,
			addAsTile: MaphubViewerApp.#onAddAsTile,
		},
	};

	// ── Render pipeline ───────────────────────────────────────────────────────

	/**
	 * Return a simple container div — the iframe is injected in _onRender
	 * so we can use async and are guaranteed the element is in the DOM.
	 */
	async _renderHTML(_context, _options) {
		const container = document.createElement("div");
		container.className = "sdx-maphub-container";
		container.style.cssText = "width:100%;height:100%;overflow:hidden;position:relative;";
		return container;
	}

	/**
	 * result = return value of _renderHTML (our container div)
	 * content = the application's .window-content element
	 */
	_replaceHTML(result, content, _options) {
		content.replaceChildren(result);
	}

	/**
	 * After the container div is in the DOM, build the src and inject the
	 * iframe entirely via DOM — iframe.sandbox is a DOMTokenList, so values
	 * set here are NEVER passed through FoundryVTT's HTML sanitizer.
	 */
	async _onRender(_context, _options) {
		window.addEventListener("message", this._onMessage);

		const container = this.element.querySelector(".sdx-maphub-container");
		if (!container) return;

		const src = await this._buildSrc();
		if (!src) {
			container.textContent = "Failed to load settlement map.";
			return;
		}

		let loadedJsonText = null;

		// Clear Maphub buffers from Foundry's localStorage to prevent 
		// ghost maps from loading via Watabou's auto-restore behavior.
		const watabouKeys = [
			"_toy_town_buf_",
			"{{LOCALSTORAGE_TOWN_BUF}}",
			"town_buf",
			"village_buf",
			"cave_buf",
			"dwellings_buf"
		];
		watabouKeys.forEach(k => window.localStorage.removeItem(k));

		// Preload saved map state (if it exists) into localStorage
		try {
			const mapId = this._getMapIdFromQuery();
			const saveStr = `data/maps/maphub/maphub_${mapId}.json`;
			const reqUrl = window.location.origin + "/" + saveStr.replace("data/", "");
			const headRes = this._mapType === "dungeon" ? null : await fetch(reqUrl, { method: "HEAD" });
			if (headRes?.ok) {
				const res = await fetch(reqUrl);
				loadedJsonText = await res.text();
				window.localStorage.setItem("_toy_town_buf_", "j" + loadedJsonText);
				ui.notifications.info("Loaded Maphub saved state!");
			}
		} catch (err) {
			// No saved file exists, ignore
		}

		const iframe = document.createElement("iframe");
		iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
		iframe.title = "Settlement Map";
		// DOMTokenList — bypasses all string-based sanitization
		iframe.sandbox.add("allow-scripts");
		iframe.sandbox.add("allow-same-origin");
		iframe.sandbox.add("allow-forms");
		iframe.sandbox.add("allow-popups");
		iframe.sandbox.add("allow-downloads");

		if (loadedJsonText) {
			iframe.onload = () => {
				console.log(`SDX | Iframe finished loading, dispatching maphub_load_json!`);
				iframe.contentWindow?.postMessage({
					type: 'maphub_load_json',
					json: loadedJsonText
				}, '*');
			};
		}

		if (this._mapType === "dungeon") {
			iframe.addEventListener("load", () => {
				setTimeout(() => {
					try {
						const doc = iframe.contentDocument;
						const cw = iframe.contentWindow;
						this._installIframeSaveHook(iframe);
						if (!doc?.querySelector("canvas") && doc?.getElementById("openfl-content") && cw?.lime?.$scripts?.Dungeon) {
							cw.lime.embed("Dungeon", "openfl-content", 0, 0, { parameters: {} });
							this._installIframeSaveHook(iframe);
						}
					} catch (err) {
						console.warn(`${MODULE_ID} | Failed to ensure dungeon generator canvas`, err);
					}
				}, 250);
				setTimeout(() => this._installIframeSaveHook(iframe), 1000);
				setTimeout(() => this._installIframeSaveHook(iframe), 2500);
			}, { once: true });
		}

		iframe.src = src;

		container.replaceChildren(iframe);
		this._iframe = iframe;
	}

	// ── Header controls ───────────────────────────────────────────────────────

	/** Add header controls. */
	_getHeaderControls() {
		const controls = super._getHeaderControls?.() ?? [];

		// Add "Set as Background"
		controls.unshift({
			icon: "fa-solid fa-image",
			label: "Set as BG",
			action: "setAsBackground",
		});

		// Add "Import Scene"
		controls.unshift({
			icon: "fa-solid fa-map",
			label: "Import Scene",
			action: "importScene",
		});

		// Add "Add as Tile"
		controls.unshift({
			icon: "fa-solid fa-cubes",
			label: "Add as Tile",
			action: "addAsTile",
		});

		// Add "Show to Players"
		controls.unshift({
			icon: "fa-solid fa-eye",
			label: "Show to Players",
			action: "showToPlayers",
		});

		// Add "Export to Chat"
		controls.unshift({
			icon: "fa-solid fa-comment-dots", // changed icon so it does not conflict
			label: "Export to Chat",
			action: "exportToChat",
		});

		// Add "Save Map State"
		controls.unshift({
			icon: "fa-solid fa-floppy-disk",
			label: "Save Map State",
			action: "saveMapState",
		});

		return controls;
	}

	/** Action handler for Export to Chat header button. */
	static async #onExportToChat() {
		await this._exportToChat();
	}

	/** Action handler for Show to Players header button. */
	static async #onShowToPlayers() {
		await this._showToPlayers();
	}

	/** Action handler for Set as BG header button. */
	static async #onSetAsBackground() {
		await this._setAsBackground();
	}

	/** Action handler for Import Scene header button. */
	static async #onImportScene() {
		await this._importScene();
	}

	/** Action handler for Add as Tile header button. */
	static async #onAddAsTile() {
		await this._addAsTile();
	}

	/** Action handler for Save Map State header button. */
	static async #onSaveMapState() {
		ui.notifications.info("To save the map state, Right-Click the map, go to Export as -> JSON. The state will silently save to the server instead of downloading.", { permanent: true });
	}

	_getMapIdFromQuery() {
		try {
			const params = new URLSearchParams(this._queryString);
			const seed = params.get("seed") || "noseed";
			const name = params.get("name") || "noname";
			return `${this._mapType}_${seed}_${name}`.replace(/[^a-zA-Z0-9_\-]/g, "");
		} catch (e) {
			return `unknown_${Date.now()}`;
		}
	}

	_installIframeSaveHook(iframe) {
		try {
			const cw = iframe?.contentWindow;
			if (!cw || typeof cw.saveAs !== "function" || cw.saveAs.__sdxFoundrySaveAs) return false;

			const originalSaveAs = cw.saveAs;
			const app = this;
			const foundrySaveAs = function (blob, filename, ...rest) {
				if (filename) {
					if (filename.endsWith(".json") || filename.endsWith(".pb")) {
						void app._onMessage({ data: { type: "maphub_save_json", blob, filename } });
						return;
					}
					if (filename.endsWith(".png")) {
						void app._onMessage({ data: { type: "maphub_save_image", blob, filename, format: "png" } });
						return;
					}
					if (filename.endsWith(".svg")) {
						void app._onMessage({ data: { type: "maphub_save_image", blob, filename, format: "svg" } });
						return;
					}
				}
				return originalSaveAs.call(this, blob, filename, ...rest);
			};
			foundrySaveAs.__sdxFoundrySaveAs = true;
			cw.saveAs = foundrySaveAs;
			return true;
		} catch (err) {
			console.warn(`${MODULE_ID} | Failed to install Maphub save hook`, err);
			return false;
		}
	}

	async _onMessage(event) {
		if (event.data && event.data.type === "maphub_save_json") {
			const { blob, filename } = event.data;

			const mapId = this._getMapIdFromQuery();
			const saveFilename = `maphub_${mapId}.json`;
			const uploadPath = `maps/maphub`;

			try {
				await FilePicker.createDirectory("data", "maps").catch(() => { });
				await FilePicker.createDirectory("data", uploadPath).catch(() => { });

				const jsonText = typeof blob?.text === "function" ? await blob.text() : String(blob ?? "");
				if (this._mapType === "dungeon" && filename.endsWith(".json")) {
					this._lastSavedDungeonJson = JSON.parse(jsonText);
					this._lastSavedDungeonJsonAt = Date.now();
				}
				const file = new File([jsonText], saveFilename, { type: "application/json" });
				const response = await FilePicker.upload("data", uploadPath, file, {});
				if (response?.path) {
					ui.notifications.info(`Map state saved to ${saveFilename}!`);
				} else {
					ui.notifications.error("Failed to upload map state.");
				}
			} catch (e) {
				console.error(`${MODULE_ID} | Failed to save map state`, e);
				ui.notifications.error("Failed to upload map state.");
			}
		} else if (event.data && event.data.type === "maphub_save_image") {
			const { blob, filename, format } = event.data;

			const mapId = this._getMapIdFromQuery();
			const timestamp = Date.now();
			const saveFilename = `maphub_${mapId}_${timestamp}.${format}`;
			const uploadPath = `maps/maphub`;

			try {
				await FilePicker.createDirectory("data", "maps").catch(() => { });
				await FilePicker.createDirectory("data", uploadPath).catch(() => { });

				let fileBlob = blob;
				if (typeof blob === "string") {
					fileBlob = new Blob([blob], { type: format === "svg" ? "image/svg+xml" : "image/png" });
				}

				const file = new File([fileBlob], saveFilename, { type: format === "svg" ? "image/svg+xml" : "image/png" });
				const response = await FilePicker.upload("data", uploadPath, file, {});
				if (response?.path) {
					if (this._pendingCaptureResolve) {
						this._pendingCaptureResolve(response.path);
						this._pendingCaptureResolve = null;
					} else {
						ui.notifications.info(`Image saved to ${saveFilename}!`);
					}
				} else {
					if (this._pendingCaptureResolve) {
						this._pendingCaptureResolve(null);
						this._pendingCaptureResolve = null;
					}
					ui.notifications.error("Failed to upload map image.");
				}
			} catch (e) {
				console.error(`${MODULE_ID} | Failed to save map image`, e);
				if (this._pendingCaptureResolve) {
					this._pendingCaptureResolve(null);
					this._pendingCaptureResolve = null;
				}
				ui.notifications.error("Failed to upload map image.");
			}
		}
	}

	// ── Export and Share ──────────────────────────────────────────────────────

	/**
	 * Common helper to capture the canvas, convert to PNG, and upload.
	 * Returns the uploaded file path, or null on failure.
	 */
	async _captureAndUploadMap() {
		const iframe = this._iframe;
		if (!iframe) {
			ui.notifications.warn("Map not loaded yet.");
			return null;
		}

		const cw = iframe.contentWindow;

		let exportFn = null;
		if (cw?.maphubVillageAppInstance?.view?.exportPNG) {
			exportFn = () => cw.maphubVillageAppInstance.view.exportPNG();
		} else if (cw?.maphubCaveAppInstance?.exportPNG) {
			exportFn = () => cw.maphubCaveAppInstance.exportPNG();
		} else if (cw?.maphubDwellingsAppInstance?.exportAsPNG) {
			// Note: Dwellings might not have a working exportAsPNG natively, but we hook it if it does
			exportFn = () => cw.maphubDwellingsAppInstance.exportAsPNG();
		} else if (cw?.maphubAppInstance?.asPNG) { // MFCG
			exportFn = () => cw.maphubAppInstance.asPNG();
		}

		if (exportFn) {
			ui.notifications.info("Generating high-resolution map...");
			return new Promise((resolve) => {
				this._pendingCaptureResolve = resolve;
				try {
					exportFn();
				} catch (e) {
					console.error("Failed to run high-res export", e);
					this._pendingCaptureResolve = null;
					resolve(null);
				}
				// 15 second timeout to prevent hanging if the generator fails silently
				setTimeout(() => {
					if (this._pendingCaptureResolve === resolve) {
						ui.notifications.error("High-res export timed out.");
						this._pendingCaptureResolve = null;
						resolve(null);
					}
				}, 15000);
			});
		}

		let canvas;
		try {
			canvas = iframe.contentDocument?.querySelector("canvas");
		} catch (e) {
			ui.notifications.error("Cannot access map canvas (cross-origin).");
			return null;
		}
		if (!canvas) {
			ui.notifications.warn("No canvas found in the map viewer.");
			return null;
		}

		ui.notifications.info("Capturing map...");

		try {
			const blob = await new Promise((resolve, reject) => {
				canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
			});

			const timestamp = Date.now();
			const genType = this._mapType || "map";
			const filename = `${genType}_${timestamp}.png`;
			const uploadPath = `maps/maphub`;

			// Foundry's createDirectory isn't recursive, so we create parent first
			await FilePicker.createDirectory("data", "maps").catch(() => { });
			await FilePicker.createDirectory("data", uploadPath).catch(() => { });

			const file = new File([blob], filename, { type: "image/png" });
			const response = await FilePicker.upload("data", uploadPath, file, {});
			if (!response?.path) {
				ui.notifications.error("Failed to upload map image.");
				return null;
			}
			return response.path;
		} catch (e) {
			console.error(`${MODULE_ID} | Map capture failed:`, e);
			ui.notifications.error(`Capture failed: ${e.message}`);
			return null;
		}
	}

	/** Export to chat. */
	async _exportToChat() {
		const imgPath = await this._captureAndUploadMap();
		if (!imgPath) return;

		try {
			await ChatMessage.create({
				content: `<div style="text-align:center;">
					<p><strong>🗺️ ${this._getMapLabel()}</strong></p>
					<img src="${imgPath}" style="max-width:100%;border-radius:6px;border:1px solid #555;" />
				</div>`,
				speaker: ChatMessage.getSpeaker(),
			});
			ui.notifications.info("Map exported to chat!");
		} catch (e) {
			ui.notifications.error("Failed to create chat message.");
		}
	}

	/** Show image to players using ImagePopout. */
	async _showToPlayers() {
		const imgPath = await this._captureAndUploadMap();
		if (!imgPath) return;

		try {
			const ip = new ImagePopout(imgPath, { title: this._getMapLabel() });
			ip.render(true);
			ip.shareImage();
			ui.notifications.info("Map shared with players!");
		} catch (e) {
			ui.notifications.error("Failed to share image.");
		}
	}

	/** Capture the current Maphub generator output and create a new Foundry scene. */
	async _importScene() {
		if (!game.user.isGM) return;

		const isDwellings = this._mapType === "dwellings";
		const isCave = this._mapType === "cave";
		const isDungeon = this._mapType === "dungeon";
		// For One Page Dungeon, automatically export the current JSON so the
		// wall data always matches the map image. Pressing 'J' triggers
		// Bb.exportJSON inside the generator which flows through our saveAs
		// hook → _lastSavedDungeonJson.
		if (isDungeon) {
			const exported = await this._exportCurrentDungeonJson();
			if (!exported) {
				ui.notifications.warn("Could not export dungeon JSON. Make sure the One Page Dungeon generator is fully loaded before Import Scene.");
				return;
			}
		}
		await this._dismissGeneratorContextMenu();
		const oldState = await this._maximizeForCapture();
		// Force the dungeon to render axis-aligned before capture so the walls
		// AND Foundry's grid line up. Auto-rotation otherwise tilts the map by
		// an arbitrary angle to fit the page.
		if (isDungeon) await this._forceDungeonAxisAligned();
		const imgPath = await this._captureAndUploadMap();
		if (!imgPath) {
			if (isDwellings) this._restoreAfterCapture(oldState);
			return;
		}

		try {
			const sceneName = `${this._getMapLabel()} ${new Date().toLocaleString()}`;
			let grid = this._getImportGridSize();
			if (isDwellings && !this._getDwellingsFloor()) {
				throw new Error("Dwellings wall/door geometry was not available. Enable local Maphub files and reopen the generator before importing.");
			}

			let walls = [];
			let notes = [];
			let dungeonTransform = null;

			// For One Page Dungeon, derive the EXACT grid→pixel mapping from the
			// generator's own render transform (read from the live controller
			// after capture). The captured image is the full "poster" (title +
			// callouts + map); the map is only a rotated/scaled sub-region, so we
			// cannot guess scale from the image size. canvasPx = M · (grid × 30),
			// where M is map.__getRenderTransform() and 30 is the generator's
			// internal local-units-per-cell.
			if (isDungeon) {
				dungeonTransform = this._getDungeonTransform();
				if (!dungeonTransform) {
					throw new Error("One Page Dungeon render transform was not available. Reopen the generator (bundled local files) and try again.");
				}
				grid = Math.max(1, Math.round(dungeonTransform.cellPx));
			}

			let scene = await this._createImageScene({ name: sceneName, img: imgPath, grid });

			if (isDungeon) {
				try {
					const parsed = OnePageParserSD.parseDungeonData(this._lastSavedDungeonJson, 1, { gridSpace: true });
					const T = dungeonTransform.toPixel;
					walls = (parsed.walls || []).map(w => {
						const a = T(w.c[0], w.c[1]);
						const b = T(w.c[2], w.c[3]);
						return { ...w, c: [a.x, a.y, b.x, b.y] };
					});
					notes = (parsed.notes || []).map(n => {
						const p = T(n.x, n.y);
						return { ...n, x: p.x, y: p.y };
					});
				} catch (e) {
					console.warn("Could not parse current Dungeon JSON for import", e);
				}
			} else if (isDwellings) {
				walls = this._getDwellingsWalls({ width: scene.width, height: scene.height, grid });
			} else if (isCave) {
				walls = this._getCaveWalls({ width: scene.width, height: scene.height });
			}

			if (walls.length) {
				await scene.createEmbeddedDocuments("Wall", walls);
			}
			if (notes.length) {
				await scene.createEmbeddedDocuments("Note", notes);
			}

			const wallNote = walls.length ? ` with ${walls.length} walls/doors` : "";
			const notesNote = notes.length ? ` and ${notes.length} notes` : "";
			ui.notifications.info(`Imported ${scene?.name ?? "map"} as a Foundry scene${wallNote}${notesNote}.`);
			this.close();
		} catch (e) {
			console.error(`${MODULE_ID} | Failed to import Maphub scene`, e);
			ui.notifications.error(`Failed to import scene: ${e.message}`);
			if (isDwellings) this._restoreAfterCapture(oldState);
		}
	}

	_getDwellingsFloor() {
		const cw = this._iframe?.contentWindow;
		let house = cw?.__maphubClasses?.["dwellings.model.House"]?.inst;
		house ??= cw?.maphubDwellingScene?.house;
		return house?.floors?.[0] ?? null;
	}

	_getDwellingsWalls({ width, height, grid }) {
		const floor = this._getDwellingsFloor();
		if (!floor?.grid || !Array.isArray(floor.contour)) {
			ui.notifications.warn("Dwellings geometry was not available; imported image without walls.");
			return [];
		}

		const widthPx = Number(width) || 0;
		const heightPx = Number(height) || 0;
		const gridSize = Number(grid) || this._getImportGridSize();
		const offsetX = Math.max(0, (widthPx - (floor.grid.w * gridSize)) / 2);
		const offsetY = Math.max(0, (heightPx - (floor.grid.h * gridSize)) / 2);
		const doorType = CONST.WALL_DOOR_TYPES?.DOOR ?? 1;
		const doorClosed = CONST.WALL_DOOR_STATES?.CLOSED ?? 1;
		const walls = [];
		const used = new Set();

		const point = (node) => ({
			x: Math.round(offsetX + (node.j * gridSize)),
			y: Math.round(offsetY + (node.i * gridSize)),
		});
		const key = (edge) => {
			const a = point(edge.a);
			const b = point(edge.b);
			return [[a.x, a.y], [b.x, b.y]]
				.sort((p1, p2) => p1[0] - p2[0] || p1[1] - p2[1])
				.map(p => p.join(","))
				.join("|");
		};
		const wallData = (edge, isDoor = false) => {
			const a = point(edge.a);
			const b = point(edge.b);
			const data = { c: [a.x, a.y, b.x, b.y] };
			if (isDoor) {
				data.door = doorType;
				data.ds = doorClosed;
			}
			return data;
		};
		const add = (edge, isDoor = false) => {
			if (!edge?.a || !edge?.b) return;
			const k = key(edge);
			if (used.has(k)) return;
			used.add(k);
			walls.push(wallData(edge, isDoor));
		};

		const doors = [];
		if (floor.entrance?.door) doors.push(floor.entrance.door);
		if (typeof floor.getDoors === "function") {
			for (const door of floor.getDoors()) {
				doors.push(door.edge1 ?? door.edge2);
			}
		}
		const doorKeys = new Set(doors.filter(Boolean).map(key));
		const outerKeys = new Set(floor.contour.map(key));

		for (const door of doors) add(door, true);
		for (const edge of floor.contour) {
			if (!doorKeys.has(key(edge))) add(edge);
		}
		for (const room of floor.rooms ?? []) {
			for (const edge of room.contour ?? []) {
				const k = key(edge);
				if (outerKeys.has(k) || doorKeys.has(k)) continue;
				add(edge);
			}
		}

		return walls;
	}

	/**
	 * Resolve the live Cave generator model instance from the iframe.
	 * Cave.js is patched to expose its Haxe class map as window.__maphubClasses;
	 * cave.model.Model keeps the current model on its static `.inst`.
	 * @returns {object|null}
	 */
	_getCaveModel() {
		const cw = this._iframe?.contentWindow;
		let model = cw?.__maphubClasses?.["cave.model.Model"]?.inst ?? null;
		model ??= cw?.maphubCaveAppInstance?.model ?? null;
		return model;
	}

	/**
	 * Build Foundry Wall documents that trace the cave outline polygons.
	 *
	 * The Cave generator stores its geometry in model coordinates:
	 *   - `model.simple`  : array of closed polygons (outer cave boundary +
	 *                       any interior stone "island" boundaries), one vertex
	 *                       per outline hex-edge.
	 *   - `model.rect`    : bounds of the main outline (model coords).
	 *
	 * The exported PNG (which becomes the scene background) is produced by
	 * Cave's `exportPNG()` with a deterministic transform derived purely from
	 * `model.rect`.  We recompute that exact transform here so the walls line up
	 * with the imported image, then map every polygon edge to a wall segment.
	 * @param {{ width: number, height: number }} dims The created scene size.
	 * @returns {object[]} Wall document data.
	 */
	_getCaveWalls({ width, height }) {
		const model = this._getCaveModel();
		const polys = model?.simple ?? model?.curves;
		const rect = model?.rect;
		if (!Array.isArray(polys) || !polys.length || !rect) {
			ui.notifications.warn("Cave geometry was not available; imported image without walls.");
			return [];
		}

		const rectW = Number(rect.width) || 0;
		const rectH = Number(rect.height) || 0;
		if (rectW <= 0 || rectH <= 0) return [];
		const left = (typeof rect.get_left === "function") ? rect.get_left() : rect.x;
		const right = (typeof rect.get_right === "function") ? rect.get_right() : (rect.x + rectW);
		const top = (typeof rect.get_top === "function") ? rect.get_top() : rect.y;
		const bottom = (typeof rect.get_bottom === "function") ? rect.get_bottom() : (rect.y + rectH);

		// Mirror Cave.exportPNG(): pad the model rect by 20% of its larger side,
		// fit-scale the view (b), then scale the bitmap so total pixels ~= 16.7M (k).
		const pad = 0.2 * Math.max(rectW, rectH);
		const D = rectW + pad;
		const F = rectH + pad;
		let b = Math.min(D / rectW, F / rectH);
		if (b > 1) b = Math.sqrt(b);
		b /= 1.1;
		const k = Math.sqrt(16777215 / (D * F));
		const viewX = (D / 2) - (b * (left + right) / 2);
		const viewY = (F / 2) - (b * (top + bottom) / 2);

		// Pixel size the exporter produced; rescale onto the actual scene size in
		// case the importer adjusted dimensions.
		const pngW = Math.floor(D * k) || 1;
		const pngH = Math.floor(F * k) || 1;
		const sx = (Number(width) || pngW) / pngW;
		const sy = (Number(height) || pngH) / pngH;

		const toPixel = (pt) => ({
			x: Math.round((k * (viewX + b * pt.x)) * sx),
			y: Math.round((k * (viewY + b * pt.y)) * sy),
		});

		const walls = [];
		for (const poly of polys) {
			if (!Array.isArray(poly) || poly.length < 3) continue;
			let pts = poly
				.filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y))
				.map(toPixel);
			// Drop consecutive duplicate pixels.
			pts = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
			// Collapse near-collinear runs (straight hex edges) into single walls.
			pts = this._simplifyClosedLoop(pts, 1.5);
			if (pts.length < 2) continue;
			for (let i = 0; i < pts.length; i++) {
				const a = pts[i];
				const c = pts[(i + 1) % pts.length];
				if (a.x === c.x && a.y === c.y) continue;
				walls.push({ c: [a.x, a.y, c.x, c.y] });
			}
		}
		return walls;
	}

	/**
	 * Remove vertices of a closed polygon that lie (within `eps` px) on the line
	 * between their neighbours, so long straight runs become a single wall.
	 * @param {{x:number,y:number}[]} pts Closed-loop points (no repeated first/last).
	 * @param {number} eps Perpendicular tolerance in pixels.
	 * @returns {{x:number,y:number}[]}
	 */
	_simplifyClosedLoop(pts, eps) {
		let arr = pts.slice();
		let changed = true;
		while (changed && arr.length > 3) {
			changed = false;
			const n = arr.length;
			const keep = new Array(n).fill(true);
			for (let i = 0; i < n; i++) {
				const prev = arr[(i - 1 + n) % n];
				const next = arr[(i + 1) % n];
				if (this._pointSegDistance(arr[i], prev, next) <= eps) keep[i] = false;
			}
			// Never drop two adjacent vertices in the same pass.
			for (let i = 0; i < n; i++) {
				if (!keep[i] && !keep[(i + 1) % n]) keep[(i + 1) % n] = true;
			}
			const out = arr.filter((_, i) => keep[i]);
			if (out.length !== arr.length && out.length >= 3) {
				arr = out;
				changed = true;
			}
		}
		return arr;
	}

	/** Perpendicular distance from point `p` to the segment `a`-`b`. */
	_pointSegDistance(p, a, b) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx * dx + dy * dy;
		if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
		let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
		t = Math.max(0, Math.min(1, t));
		const projX = a.x + t * dx;
		const projY = a.y + t * dy;
		return Math.hypot(p.x - projX, p.y - projY);
	}

	_getImportGridSize() {
		return this._mapType === "dwellings" ? 260 : 50;
	}

	/**
	 * Watabou's OpenFL generators draw their right-click menu inside the canvas.
	 * If Import Scene is clicked while that menu is still open, it gets baked
	 * into the captured scene background. Send Escape and a harmless click into
	 * the iframe before capture so the canvas redraws without the menu.
	 */
	async _dismissGeneratorContextMenu() {
		try {
			const doc = this._iframe?.contentDocument;
			const cw = this._iframe?.contentWindow;
			const canvas = doc?.querySelector("canvas");
			if (!doc || !cw || !canvas) return;
			const escape = new cw.KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
			doc.dispatchEvent(escape);
			canvas.dispatchEvent(escape);

			const rect = canvas.getBoundingClientRect();
			const eventInit = { bubbles: true, cancelable: true, clientX: rect.left + 4, clientY: rect.top + 4, button: 0, buttons: 1 };
			canvas.dispatchEvent(new cw.MouseEvent("mousedown", eventInit));
			canvas.dispatchEvent(new cw.MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
			canvas.dispatchEvent(new cw.MouseEvent("click", { ...eventInit, buttons: 0 }));
			await new Promise(resolve => setTimeout(resolve, 250));
		} catch (err) {
			console.warn(`${MODULE_ID} | Failed to dismiss generator context menu`, err);
		}
	}

	/**
	 * Trigger the One Page Dungeon generator's native JSON export (key 'J')
	 * so that _lastSavedDungeonJson is populated from the CURRENT dungeon
	 * state — guaranteeing walls always match the same map that gets captured.
	 */
	async _exportCurrentDungeonJson() {
		try {
			const cw = this._iframe?.contentWindow;
			const doc = this._iframe?.contentDocument;
			if (!cw || !doc) return false;

			this._lastSavedDungeonJson = null;
			this._lastSavedDungeonJsonAt = 0;

			const keyEvent = new cw.KeyboardEvent("keydown", {
				key: "j", code: "KeyJ", keyCode: 74, which: 74,
				bubbles: true, cancelable: true
			});
			doc.body?.dispatchEvent(keyEvent);
			doc.dispatchEvent(keyEvent);

			// Poll for saveAs hook to deliver the JSON (up to 5 s)
			for (let i = 0; i < 50; i++) {
				await new Promise(r => setTimeout(r, 100));
				if (this._lastSavedDungeonJson) return true;
			}
			return false;
		} catch (err) {
			console.warn(`${MODULE_ID} | Failed to export dungeon JSON`, err);
			return false;
		}
	}

	/**
	 * The bundled One Page Dungeon generator (Dungeon.js) is patched to expose
	 * its live view controller on the iframe window as `__sdxDungeonView`.
	 * It carries the map sprite, dungeon data, and toggle methods.
	 * @returns {object|null}
	 */
	_getDungeonController() {
		try {
			return this._iframe?.contentWindow?.__sdxDungeonView ?? null;
		} catch (_) {
			return null;
		}
	}

	/**
	 * Internal local-units-per-grid-cell the generator draws the dungeon at.
	 * The map sprite's floor layer bounds equal (gridBounds × 30) exactly, so 30
	 * is the constant. We still verify it against the live floor layer when the
	 * geometry is available, and fall back to the constant otherwise.
	 */
	_DUNGEON_CELL = 30;

	_resolveDungeonCell(view) {
		try {
			const map = view?.map;
			const rects = view?.dungeon?.rects || this._lastSavedDungeonJson?.rects;
			const kids = map?.__children;
			if (!map || !Array.isArray(rects) || !rects.length || !Array.isArray(kids)) return this._DUNGEON_CELL;
			let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
			for (const r of rects) {
				minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w);
				minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.h);
			}
			const gW = maxX - minX, gH = maxY - minY;
			if (gW <= 0 || gH <= 0) return this._DUNGEON_CELL;
			// The floor layer's local bounds tightly equal the grid bbox × cell.
			// Pick the child whose x/y cell-sizes agree and are an integer.
			let best = null;
			for (const c of kids) {
				let b; try { b = c.getBounds(map); } catch (_) { continue; }
				const cx = b.width / gW, cy = b.height / gH;
				if (!(cx > 0) || !(cy > 0)) continue;
				const avg = (cx + cy) / 2;
				const disagree = Math.abs(cx - cy);
				const nonInt = Math.abs(avg - Math.round(avg));
				if (disagree <= 0.05 && nonInt <= 0.05) {
					if (!best || (disagree + nonInt) < best.score) best = { cell: Math.round(avg), score: disagree + nonInt };
				}
			}
			return best?.cell || this._DUNGEON_CELL;
		} catch (_) {
			return this._DUNGEON_CELL;
		}
	}

	/**
	 * If the generator auto-rotated the dungeon, toggle rotation off so it
	 * renders axis-aligned. Called after the capture window is maximized and
	 * before the canvas is captured, so the captured image is axis-aligned.
	 */
	async _forceDungeonAxisAligned() {
		try {
			const view = this._getDungeonController();
			if (!view?.map) return;
			const rot = view.map.__rotation ?? view.map.get_rotation?.() ?? 0;
			if (Math.abs(rot) < 0.001) return;
			if (typeof view.toggleRotation === "function") {
				view.toggleRotation();
				await new Promise(r => setTimeout(r, 1200));
				const after = view.map.__rotation ?? 0;
				// If it toggled the wrong way, flip back to reach 0.
				if (Math.abs(after) > 0.001 && typeof view.toggleRotation === "function") {
					view.toggleRotation();
					await new Promise(r => setTimeout(r, 1200));
				}
			}
		} catch (err) {
			console.warn(`${MODULE_ID} | Failed to force dungeon axis-aligned`, err);
		}
	}

	/**
	 * Build the exact grid→canvas-pixel mapping for the current dungeon render.
	 * Reads the generator's own render transform (`map.__getRenderTransform()`),
	 * which composes scale + translation + any rotation, so walls land exactly
	 * where the map is drawn in the captured image. Returns null if the live
	 * generator controller is not reachable.
	 *
	 * MUST be called at capture resolution (after the window is maximized and
	 * the canvas has settled) so the transform matches the captured PNG.
	 * @returns {{ toPixel: (gx:number, gy:number) => {x:number,y:number}, cellPx: number }|null}
	 */
	_getDungeonTransform() {
		try {
			const view = this._getDungeonController();
			const map = view?.map;
			if (!map || typeof map.__getRenderTransform !== "function") return null;
			const M = map.__getRenderTransform();
			if (!M || !Number.isFinite(M.a)) return null;
			const cell = this._resolveDungeonCell(view);
			const toPixel = (gx, gy) => {
				const lx = gx * cell, ly = gy * cell;
				return {
					x: Math.round(M.a * lx + M.c * ly + M.tx),
					y: Math.round(M.b * lx + M.d * ly + M.ty),
				};
			};
			const cellPx = cell * Math.hypot(M.a, M.b);
			return { toPixel, cellPx };
		} catch (err) {
			console.warn(`${MODULE_ID} | Failed to read dungeon render transform`, err);
			return null;
		}
	}

	async _createImageScene({ name, img, grid }) {
		const loader = new foundry.canvas.TextureLoader();
		const texture = await loader.loadTexture(img);
		const sceneData = {
			name,
			grid: { size: grid },
			width: texture.width,
			height: texture.height,
			padding: 0,
			fogExploration: true,
			tokenVision: true,
		};

		const foundryMajor = Number(game.version?.split?.(".")?.[0] ?? 0);
		if (foundryMajor >= 14) {
			sceneData.levels = [{
				name: "Level",
				background: { src: img },
			}];
		} else {
			sceneData.background = { src: img };
		}

		const scene = await Scene.create(sceneData);
		await scene.activate();
		return scene;
	}

	/**
	 * Force the application window to a massive size (2000x2000 minimum)
	 * to ensure the internal map canvas redraws at high resolution.
	 * @returns {Promise<{ position: object, style: object }>} The previous window state.
	 */
	async _maximizeForCapture() {
		ui.notifications.info("Preparing map for high-res capture...");

		const oldState = {
			position: foundry.utils.deepClone(this.position),
			style: this.element ? {
				minHeight: this.element.style.minHeight,
				minWidth: this.element.style.minWidth,
				maxWidth: this.element.style.maxWidth,
				maxHeight: this.element.style.maxHeight,
				left: this.element.style.left,
				top: this.element.style.top,
				zIndex: this.element.style.zIndex
			} : null
		};

		try {
			if (typeof this.setPosition === "function") {
				this.setPosition({ left: 0, top: 0 });
			}
			if (this.element) {
				this.element.style.minHeight = "2000px";
				this.element.style.minWidth = "2000px";
				this.element.style.maxWidth = "none";
				this.element.style.maxHeight = "none";
				this.element.style.left = "0px";
				this.element.style.top = "0px";
				this.element.style.zIndex = "9999";
			}
		} catch (e) {
			console.warn("Failed to maximize dialog window:", e);
		}
		// Give the iframe/canvas time to resize and redraw completely
		await new Promise(r => setTimeout(r, 1500));
		return oldState;
	}

	/**
	 * Restore the application window to its previous state.
	 * @param {{ position: object, style: object }} state The state to restore.
	 */
	_restoreAfterCapture(state) {
		if (!state) return;
		if (state.position) {
			this.setPosition(state.position);
		}
		if (this.element && state.style) {
			Object.assign(this.element.style, state.style);
		}
	}

	/** Set the map image as the current scene's background. */
	async _setAsBackground() {
		if (!game.user.isGM) return;
		if (!canvas?.scene) {
			ui.notifications.warn("No active scene to set background for!");
			return;
		}

		const isDwellings = this._mapType === "dwellings";
		const oldState = await this._maximizeForCapture();

		const imgPath = await this._captureAndUploadMap();
		if (!imgPath) {
			if (isDwellings) this._restoreAfterCapture(oldState);
			return;
		}

		try {
			// Create a temporary image to determine dimensions before applying
			const img = new Image();
			img.onload = async () => {
				const sceneUpdateData = {
					width: img.width,
					height: img.height,
					padding: 0,
					grid: { size: isDwellings ? 260 : 50 }
				};

				// Foundry V14 stores scene imagery on the embedded Level, not the
				// legacy top-level scene background. Update the active level when
				// available so "Set as Background" does not create a blank scene.
				const foundryMajor = Number(game.version?.split?.(".")?.[0] ?? 0);
				const levelId = canvas.level?.id ?? canvas.scene.levels?.contents?.[0]?.id;
				if (foundryMajor >= 14 && levelId) {
					sceneUpdateData[`levels.${levelId}.background.src`] = imgPath;
				} else {
					sceneUpdateData.background = { src: imgPath };
				}

				await canvas.scene.update(sceneUpdateData);
				ui.notifications.info(`Scene background updated to ${img.width}x${img.height}!`);

				if (isDwellings) {
					this._restoreAfterCapture(oldState);
				} else {
					this.close(); // Close the dialog
				}
			};
			img.onerror = () => {
				// Fallback if we can't load the image dimensions for some reason
				canvas.scene.update({ background: { src: imgPath } });
				ui.notifications.info("Scene background updated (kept previous dimensions).");

				if (isDwellings) {
					this._restoreAfterCapture(oldState);
				} else {
					this.close(); // Close the dialog
				}
			};
			img.src = imgPath;
		} catch (e) {
			console.error(`${MODULE_ID} | Failed to set scene background`, e);
			ui.notifications.error("Failed to set scene background.");
			if (isDwellings) this._restoreAfterCapture(oldState);
		}
	}

	/** Export the map as a Tile on the active scene. */
	async _addAsTile() {
		if (!game.user.isGM) return;
		if (!canvas?.scene) {
			ui.notifications.warn("No active scene to add tile to!");
			return;
		}

		const isDwellings = this._mapType === "dwellings";
		const oldState = await this._maximizeForCapture();

		const imgPath = await this._captureAndUploadMap();
		if (!imgPath) {
			if (isDwellings) this._restoreAfterCapture(oldState);
			return;
		}

		try {
			// Create a temporary image to determine dimensions before applying
			const img = new Image();
			img.onload = async () => {
				const tileData = {
					texture: { src: imgPath },
					width: img.width,
					height: img.height,
					x: canvas.stage.pivot.x - (img.width / 2),
					y: canvas.stage.pivot.y - (img.height / 2)
				};

				await canvas.scene.createEmbeddedDocuments("Tile", [tileData]);
				ui.notifications.info(`Map added as a ${img.width}x${img.height} tile!`);

				if (isDwellings) {
					this._restoreAfterCapture(oldState);
				} else {
					this.close(); // Close the dialog
				}
			};
			img.onerror = () => {
				ui.notifications.error("Failed to load map image dimensions for Tile.");
				if (isDwellings) this._restoreAfterCapture(oldState);
			};
			img.src = imgPath;
		} catch (e) {
			console.error(`${MODULE_ID} | Failed to add map as tile`, e);
			ui.notifications.error("Failed to add map as tile.");
			if (isDwellings) this._restoreAfterCapture(oldState);
		}
	}

	/** Human-readable label for the map type. */
	_getMapLabel() {
		const labels = {
			mfcg: "City Map",
			village: "Village Map",
			cave: "Cave Map",
			dungeon: "Dungeon Map",
			dwellings: "Dwelling Map",
			viewer: "3D City View",
		};
		return labels[this._mapType] || "Settlement Map";
	}

	/**
	 * Override close() — NOT _onClose() — because ApplicationV2 destroys the
	 * DOM element BEFORE _onClose fires.  We must rescue the iframe out of
	 * Foundry's element tree first, then let super.close() safely tear down
	 * the now-empty application window.
	 *
	 * The rescued iframe lives in a hidden off-screen div where the mfcg.js
	 * OpenFL rAF loop can finish its current frame harmlessly.  After a short
	 * delay we navigate to about:blank to unload the JS context, then remove
	 * the hidden div.
	 */
	async close(options) {
		// Restore dungeon rotation if we turned it off for import
		if (this._saveRotationWasOn) {
			try {
				const rotKey = [...Object.keys(window.localStorage)].find(k =>
					k.includes('com.watabou.dungeon')
				);
				if (rotKey) {
					const val = window.localStorage.getItem(rotKey) || '';
					window.localStorage.setItem(rotKey, val.replace('autoRotationf', 'autoRotationt'));
				}
			} catch (err) {
				console.warn(`${MODULE_ID} | Failed to restore dungeon rotation`, err);
			}
		}
		window.removeEventListener("message", this._onMessage);
		if (this._blobUrl) {
			URL.revokeObjectURL(this._blobUrl);
			this._blobUrl = null;
		}

		const iframe = this.element?.querySelector("iframe");
		if (iframe) {
			// Park the iframe off-screen before Foundry nukes the app element
			const graveyard = document.createElement("div");
			graveyard.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;";
			document.body.appendChild(graveyard);
			graveyard.appendChild(iframe);

			// Kill JS context after the rAF loop settles, then clean up
			setTimeout(() => {
				try { iframe.src = "about:blank"; } catch (_) { }
				setTimeout(() => graveyard.remove(), 500);
			}, 100);
		}
		return super.close(options);
	}

	/** Build the iframe src. */
	async _buildSrc() {
		const ext = this._queryString ? `${this._externalBase}?${this._queryString}` : this._externalBase;
		// Dungeon import depends on the bundled local generator so its exports can
		// be intercepted and converted inside Foundry. Never open the external
		// Watabou page for dungeon imports, regardless of the general Maphub setting.
		const useLocal = this._mapType === "dungeon" || game.settings.get(MODULE_ID, "settlement.useLocalMaphub");
		if (!useLocal) {
			console.log(`${MODULE_ID} | MaphubViewerApp: using external URL ${ext}`);
			return ext;
		}

		// Use the direct server URL for local maphub files when Foundry serves it
		// as HTML. Some Foundry installs serve static .html module files as
		// text/plain; in that case, wrap the same file in a same-origin Blob with
		// a <base> tag so scripts/assets still resolve and the parent window can
		// inspect/capture the generator.
		const BASE = `modules/${MODULE_ID}/scripts/maphub`;
		const localBase = `${window.location.origin}/${BASE}/to/${this._mapType}/index.html`;
		const localBaseDir = `${window.location.origin}/${BASE}/to/${this._mapType}/`;
		const localParams = this._queryString ? `cb=${Date.now()}&${this._queryString}` : `cb=${Date.now()}`;
		const localUrl = `${localBase}?${localParams}`;

		// Quick HEAD probe to confirm the file exists locally.
		try {
			const r = await fetch(localUrl, { method: "HEAD" });
			if (r.ok) {
				const contentType = r.headers.get("content-type") ?? "";
				if (contentType.includes("text/html")) {
					console.log(`${MODULE_ID} | MaphubViewerApp: using local URL ${localUrl}`);
					return localUrl;
				}

				const res = await fetch(localUrl);
				let html = await res.text();
				if (!/^\s*<!doctype html/i.test(html) && !/^\s*<html/i.test(html)) {
					console.warn(`${MODULE_ID} | MaphubViewerApp: local file was not HTML, using external: ${ext}`);
					return ext;
				}

				html = html
					.replace(/<head([^>]*)>/i, `<head$1><base href="${localBaseDir}">`)
					.replace(/(\.\.\/\.\.\/js\/[^"]+\.js)(")/g, `$1?cb=${Date.now()}$2`);
				this._blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
				console.log(`${MODULE_ID} | MaphubViewerApp: using local Blob URL for ${localUrl}`);
				return this._blobUrl;
			}
		} catch (_) { /* network error → fall through */ }

		if (this._mapType === "dungeon") {
			console.error(`${MODULE_ID} | MaphubViewerApp: bundled One Page Dungeon files are missing; refusing external fallback because exports would download instead of saving inside Foundry.`);
			ui.notifications?.error("Bundled One Page Dungeon files are missing; cannot import dungeon internally.");
			return null;
		}

		// Local files not present — fall back to external URL.
		console.warn(`${MODULE_ID} | MaphubViewerApp: local files missing, using external: ${ext}`);
		return ext;
	}

}
