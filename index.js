const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const path = require("path");
const fs = require("fs");


function extractEntryPoints(htmlFile, document) {
    let entryPoints = [];
    const scripts = Array.from(document.getElementsByTagName('script'))
    const styles = Array.from(document.getElementsByTagName('link'));
    entryPoints.push(
        ...scripts.filter(e => e.hasAttribute('type')).map(e => e.removeChild(e) && e.getAttribute('src')),
        ...styles.filter(e => e.getAttribute('rel') == 'stylesheet').map(e => e.removeChild(e) && e.getAttribute('href'))
    );
    return entryPoints.map(ep => path.relative(process.cwd(), path.dirname(htmlFile) + '/' + ep));  
}


module.exports = () => ({
    name: 'html',
    setup({initialOptions, onEnd}) {
        if (!initialOptions.outdir) throw new Error('Cannot use html-plugin without an outdir specified.');
        if (!initialOptions.metafile) throw new Error('Cannot use html-plugin without a metafile enabled.');
        if (initialOptions.entryPoints.length > 1) throw new Error('There can only be 1 entry .html file.');
        if (!initialOptions.entryPoints[0].endsWith("html")) throw new Error('Only .html files are permitted as an entrypoint.');

        const entryPoint = initialOptions.entryPoints[0];
        const document = new DOMParser().parseFromString(fs.readFileSync(entryPoint, 'utf8'), 'text/html');
        
        initialOptions.entryPoints = [];
        initialOptions.entryPoints.push(...extractEntryPoints(entryPoint, document));

        onEnd(async (result) => {
            const resultPaths = Object.entries(result.metafile.outputs).filter(([k,f]) => {
                return f.exports == undefined || f.exports.length == 0
            }).map(output => output[0]);
            
            resultPaths.filter(p => !p.includes('.map')).forEach(p => {
                let nodeDef;
                const resourcePath = path.relative(process.cwd() + "/" + initialOptions.outdir, p);
                if(p.includes(".css")) nodeDef = '<link rel="stylesheet" href="' + resourcePath + '"/>';
                if(p.includes(".js")) nodeDef = '<script type="module" src="'+ resourcePath +'"></script>';
                document.getElementsByTagName("head")[0].appendChild(new DOMParser().parseFromString(nodeDef));
            })

            fs.writeFileSync(initialOptions.outdir + '/index.html', new XMLSerializer().serializeToString(document));
        });
    }
});