#!/usr/bin/env ruby

require "base64"

required_files = %w[
  performance/k6/workload.js
  performance/k6/local.js
  performance/k6/aws.js
  performance/k6/fixtures/artwork.png.b64
]

missing = required_files.reject { |path| File.file?(path) }
abort "missing k6 files: #{missing.join(', ')}" unless missing.empty?

workload = File.read("performance/k6/workload.js")
local = File.read("performance/k6/local.js")
aws = File.read("performance/k6/aws.js")
errors = []

{
  "read scenario" => "read_traffic",
  "write scenario" => "write_traffic",
  "ramping executor" => "ramping-vus",
  "overall error threshold" => "http_req_failed",
  "check threshold" => "checks",
  "read p95 threshold" => "p(95)<500",
  "write p95 threshold" => "p(95)<2000",
  "read peak VUs" => "stagesFor('READ', [5, 20, 50, 0])",
  "write peak VUs" => "stagesFor('WRITE', [1, 4, 10, 0])",
  "multipart upload" => "http.file",
  "request tags" => "tags: { workflow, endpoint }",
  "artwork creation" => "/v1/artworks",
  "like flow" => "/like",
  "download flow" => "/download",
  "leaderboard read" => "/v1/leaderboard"
}.each do |feature, marker|
  errors << "shared workload is missing #{feature}" unless workload.include?(marker)
end

errors << "local script needs the Compose API default" unless local.include?("http://api:8080/api")
errors << "local script needs its own summary" unless local.include?("local-summary.json")
errors << "AWS script must require BASE_URL" unless aws.include?("BASE_URL") && aws.include?("throw new Error")
errors << "AWS script must not use a remote safety lock" if aws.match?(/ALLOW_REMOTE|UNLOCK|SAFETY_LOCK/)
errors << "AWS script needs its own summary" unless aws.include?("aws-summary.json")

fixture = Base64.strict_decode64(File.read("performance/k6/fixtures/artwork.png.b64").gsub(/\s+/, ""))
errors << "fixture is not a PNG" unless fixture.start_with?("\x89PNG\r\n\x1a\n".b)
if fixture.bytesize >= 24
  width, height = fixture.byteslice(16, 8).unpack("NN")
  errors << "fixture must be 1080 x 1080, got #{width} x #{height}" unless width == 1080 && height == 1080
else
  errors << "fixture is too small to contain a PNG header"
end

abort errors.join("\n") unless errors.empty?

puts "k6 checks passed: local + AWS, mixed read/write workload, 1080 PNG"
