import { hsGetJson } from "../clients/hubspot.js";
(async () => {
    const data = await hsGetJson("/crm/v3/objects/contacts", {
        limit: 1, properties: "email,firstname,lastname"
    });
    console.log("HS OK:", data.results?.[0]?.properties ?? data);
})();
//# sourceMappingURL=checkHs.js.map