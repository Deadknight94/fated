// Client-only application bootstrap for Node tests; never imported by production.
let nextId = 0;
class ApplicationV2 {
  constructor(options={}) { this.id=options.id ?? `test-app-${++nextId}`; this.renderCount=0; }
  async _onFirstRender() {}
  _onClose() {}
  async render() { if(!this.rendered){await this._onFirstRender({},{});this.rendered=true} this.renderCount++;this.context=await this._prepareContext({});return this; }
  async close() {this._onClose({});this.rendered=false;}
}
foundry.applications = { api: { ApplicationV2, HandlebarsApplicationMixin: Base=>class extends Base {} } };
foundry.applications.sheets = { ActorSheetV2: class extends ApplicationV2 {
  constructor(options) { super(options); this.document = options.document; this.isEditable = this.document.isOwner; }
} };
