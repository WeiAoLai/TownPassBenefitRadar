#!/usr/bin/env ruby

require "json"

dashboard_paths = {
  demo: "monitoring/grafana/dashboards/good-morning-demo.json",
  operations: "monitoring/grafana/dashboards/good-morning-backend.json"
}

missing = dashboard_paths.values.reject { |path| File.file?(path) }
abort "missing Grafana dashboards: #{missing.join(', ')}" unless missing.empty?

dashboards = dashboard_paths.transform_values { |path| JSON.parse(File.read(path)) }
errors = []

uids = dashboards.values.map { |dashboard| dashboard["uid"] }
errors << "dashboard UIDs must be present and unique" unless uids.all? { |uid| !uid.to_s.empty? } && uids.uniq.size == uids.size

dashboards.each do |name, dashboard|
  errors << "#{name} dashboard title must contain Chinese text" unless dashboard.fetch("title", "").match?(/\p{Han}/)
  errors << "#{name} dashboard description must contain Chinese text" unless dashboard.fetch("description", "").match?(/\p{Han}/)

  panels = dashboard.fetch("panels", []).reject { |panel| panel["type"] == "row" }
  errors << "#{name} dashboard must have panels" if panels.empty?
  panels.each do |panel|
    description = panel.fetch("description", "")
    unless description.match?(/\p{Han}/)
      errors << "#{name} panel #{panel['id']} (#{panel['title']}) needs a Chinese description"
    end
  end
end

demo_json = JSON.generate(dashboards[:demo])
operations_json = JSON.generate(dashboards[:operations])

business_panels = dashboards[:demo].fetch("panels").select do |panel|
  panel.fetch("targets", []).any? { |target| target.fetch("expr", "").include?("good_morning_") }
end
business_panels.each do |panel|
  expressions = panel.fetch("targets").map { |target| target.fetch("expr", "") }
  errors << "demo business panel #{panel['title']} must round event counts" unless expressions.all? { |expression| expression.include?("round(") }
  errors << "demo business panel #{panel['title']} must display zero decimals" unless panel.dig("fieldConfig", "defaults", "decimals") == 0
end

%w[
  good_morning_artworks_creation_total
  good_morning_artworks_downloaded_total
  good_morning_artwork_likes_total
].each do |metric|
  errors << "demo dashboard is missing #{metric}" unless demo_json.include?(metric)
end

{
  "endpoint latency" => "http_server_requests_seconds_bucket",
  "database pool" => "hikaricp_connections_pending",
  "JVM memory" => "jvm_memory_used_bytes",
  "error logs" => "compose_service=~\\\"api|backend\\\""
}.each do |feature, marker|
  errors << "operations dashboard is missing #{feature}" unless operations_json.include?(marker)
end

all_json = demo_json + operations_json
errors << "dashboards must use Prometheus" unless all_json.include?('"uid":"prometheus"')
errors << "dashboards must use Loki" unless all_json.include?('"uid":"loki"')

abort errors.join("\n") unless errors.empty?

puts "Grafana dashboard checks passed: #{uids.join(', ')}"
