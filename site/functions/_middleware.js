// www and the *.pages.dev hostnames redirect to the domain. Everything else is a static file.
export async function onRequest({ request, next }) {
	const url = new URL(request.url)
	if (url.hostname !== 'tldrawmods.dev') {
		url.hostname = 'tldrawmods.dev'
		return Response.redirect(url.href, 301)
	}
	return next()
}
