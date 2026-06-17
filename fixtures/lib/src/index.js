import('./lib.rs').then((mod) => {
	const result = {
		add: mod.add(2.0, 2.0),
		multiplyAvailable: typeof mod.multiply === 'function',
		multiply:
			typeof mod.multiply === 'function'
				? mod.multiply(3.0, 4.0)
				: null,
	};
	document.getElementById('result').textContent = JSON.stringify(result);
}).catch((err) => {
	document.getElementById('result').textContent = JSON.stringify({ error: err.message, stack: err.stack });
});
