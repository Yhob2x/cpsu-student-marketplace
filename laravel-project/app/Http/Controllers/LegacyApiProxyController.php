<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;

/** Local-only bridge to Express while API modules are ported. Remove at cutover. */
class LegacyApiProxyController extends Controller
{
    private const SKIP_REQUEST = ['host', 'connection', 'content-length', 'content-type', 'accept-encoding', 'transfer-encoding'];
    private const SKIP_RESPONSE = ['connection', 'content-encoding', 'content-length', 'keep-alive', 'transfer-encoding'];

    public function __invoke(Request $request, string $path): Response
    {
        $query = $request->getQueryString();
        $url = rtrim((string) config('services.legacy_api.url'), '/').'/api/'.$path.($query ? "?{$query}" : '');
        $headers = [];
        foreach ($request->headers->all() as $name => $values) {
            if (! in_array($name, self::SKIP_REQUEST, true)) {
                $headers[$name] = implode(', ', $values);
            }
        }

        $client = Http::withHeaders($headers)->withOptions(['allow_redirects' => false, 'http_errors' => false])->timeout(60);
        $options = [];
        if (str_starts_with((string) $request->header('content-type'), 'multipart/form-data')) {
            $client = $client->asMultipart();
            foreach ($request->allFiles() as $field => $files) {
                foreach (is_array($files) ? $files : [$files] as $file) {
                    $client = $client->attach($field, file_get_contents($file->getRealPath()), $file->getClientOriginalName(), ['Content-Type' => $file->getClientMimeType()]);
                }
            }
            $options = $request->post();
        } elseif ($request->getContent() !== '') {
            $client = $client->withBody($request->getContent(), (string) $request->header('content-type', 'application/octet-stream'));
        }

        try {
            $upstream = $client->send($request->method(), $url, $options ? ['multipart' => collect($options)->map(fn ($contents, $name) => ['name' => $name, 'contents' => (string) $contents])->values()->all()] : []);
        } catch (ConnectionException) {
            return response(json_encode(['error' => 'legacy_api_unavailable']), 502, ['Content-Type' => 'application/json']);
        }

        $response = new Response($upstream->body(), $upstream->status());
        foreach ($upstream->headers() as $name => $values) {
            if (! in_array(strtolower($name), self::SKIP_RESPONSE, true)) {
                foreach ($values as $value) {
                    $response->headers->set($name, $value, false);
                }
            }
        }

        return $response;
    }
}
