#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const deepMerge = require('deepmerge');

const userDir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
const kubeConfigPath = path.resolve(userDir, '.kube/config')

// Load the main kube config
const kubeConfigContents = fs.readFileSync(kubeConfigPath);
const kubeConfig = yaml.safeLoad(kubeConfigContents, 'UTF-8');

// Load the provided kube config
const otherKubeConfigPath = process.argv[2];
const otherKubeConfigContents = fs.readFileSync(otherKubeConfigPath);
const otherKubeConfig = yaml.safeLoad(otherKubeConfigContents, 'UTF-8');
// otherKubeConfig may contain relative paths to certificates, we need to adjust these now:
otherKubeConfig.clusters.forEach(function(cluster) {
	const ca = cluster.cluster['certificate-authority'];
	if (ca) {
		cluster.cluster['certificate-authority'] = path.resolve(path.dirname(otherKubeConfigPath), ca);
	}
});
otherKubeConfig.users.forEach(function(user) {
	const cert = user.user['client-certificate'];
	if (cert) {
		user.user['client-certificate'] = path.resolve(path.dirname(otherKubeConfigPath), cert);		
	}
	const key = user.user['client-key'];
	if (key) {
		user.user['client-key'] = path.resolve(path.dirname(otherKubeConfigPath), key);
	}
})

/**
 * Merge arrays of named objects.
 *
 * If elements of a contain a 'name' attribute, then elements of b with the same 'name'
 * attribute overwrite elements from a, otherwise arrays are joined using Array.prototype.concat.
 */
function namedObjectArrayMerge(a, b) {
	let result = a;
	b.forEach(function(obj) {
		if (obj.name) {
			// Remove all elements in result that have this name.
			result = result.filter(item => item.name !== obj.name);
		}
		result.push(obj);
	});
	return result;
}

const finalKubeConfig = deepMerge(kubeConfig, otherKubeConfig, { arrayMerge: namedObjectArrayMerge });

fs.writeFile(kubeConfigPath, yaml.safeDump(finalKubeConfig), function(err) {
	if (err) {
		console.error(`Cannot write ${kubeConfigPath}: ${err.message}`);
	}
});

