// middleware/breadcrumbs.js
function generateBreadcrumbs(req, res, next) {
    const breadcrumbs = [];
    const paths = req.path.split('/').filter((path) => path !== '');

    paths.forEach((path, index) => {
        const breadcrumbPath = '/' + paths.slice(0, index + 1).join('/');
        breadcrumbs.push({
            label: path.charAt(0).toUpperCase() + path.slice(1), // Capitalize the breadcrumb label
            url: breadcrumbPath,
        });
    });

    res.locals.breadcrumbs = breadcrumbs; // Pass breadcrumbs to the view
    next();
}

module.exports = generateBreadcrumbs;
