// A site is a scheme and host name ("https://meet.example.org"): Chrome match
// patterns ignore the port, so the extension does too.

export function siteKey(url) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return null;
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
        return null;
    }
    return parsed.protocol + '//' + parsed.hostname;
}

export function sitePattern(site) {
    return site + '/*';
}

export function addSite(sites, site) {
    return sites.includes(site) ? sites : [...sites, site].sort();
}

export function removeSite(sites, site) {
    return sites.filter((s) => s !== site);
}
