from flask import Flask, request, Response, send_from_directory, render_template, abort
import os
import requests
from dotenv import load_dotenv

app = Flask(__name__, static_folder=None)

load_dotenv()
APPS_SCRIPT_URL = os.environ["APPS_SCRIPT_URL"]

# This code tells browsers never to cache the rendered HTML pages. If they are,
# changes to templates won't show up until hard-refresh (ctrl+shift+r.) Static
# assets (CSS/JS/images) are cached normally and reloaded properly with ?v=ASSET_VERSION
# cache busting (see below)
@app.after_request
def no_cache_html(response):
    if response.content_type and response.content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response

# Browsers cache CSS/JS files. When you edit one, visitors keep seeing the
# OLD cached version unless something forces them to re-download. To fix this,
# every <link>/<script> in base.html ends with ?v={{ ASSET_VERSION }}. We set
# ASSET_VERSION to the newest file-modified timestamp across the assets — so
# saving style.css changes the version number, the URL changes, and browsers
# fetch the new file instead of using their stale copy.
# You don't need to touch this. It's all technically "automated"
@app.context_processor
def inject_asset_version():
    paths = ["css/style.css", "js/script.js", "js/theme-toggle.js"]
    try:
        v = int(max(os.path.getmtime(p) for p in paths))
    except OSError:
        v = 0
    return {"ASSET_VERSION": v}

# Pages: any templates/<name>.html is reachable at /<name>.html
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/<page>.html")
def page(page):
    return render_template(page + ".html")

# Static: any /css/*, /js/*, /public/* file
@app.route("/<folder>/<path:filename>")
def static_asset(folder, filename):
    if folder not in ("css", "js", "public"):
        abort(404)
    return send_from_directory(folder, filename)

# AppsScript proxy
@app.route("/api", methods=["GET", "POST", "OPTIONS"])
def proxy_api():
    if request.method == "OPTIONS":
        resp = Response()
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return resp

    if request.method == "GET":
        upstream = requests.get(APPS_SCRIPT_URL, params=request.args)
    else:
        upstream = requests.post(
            APPS_SCRIPT_URL,
            data=request.get_data(),
            headers={"Content-Type": "application/json"}
        )

    response = Response(upstream.content, status=upstream.status_code)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Content-Type"] = "application/json"
    return response

if __name__ == "__main__":
    app.run(port=5000, host="0.0.0.0")