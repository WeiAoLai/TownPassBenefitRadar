require "yaml"

document = YAML.safe_load(
  File.read("openapi.yaml"),
  [],
  [],
  true,
  "openapi.yaml"
)

raise "unexpected OpenAPI version" unless document.fetch("openapi") == "3.1.0"
raise "missing paths" if document.fetch("paths").empty?

references = []
walk = lambda do |node|
  case node
  when Hash
    references << node["$ref"] if node.key?("$ref")
    node.each_value { |value| walk.call(value) }
  when Array
    node.each { |value| walk.call(value) }
  end
end
walk.call(document)

references.uniq.each do |reference|
  raise "external reference not expected: #{reference}" unless reference.start_with?("#/")

  target = document
  reference.delete_prefix("#/").split("/").each do |segment|
    key = segment.gsub("~1", "/").gsub("~0", "~")
    raise "unresolved reference: #{reference}" unless target.is_a?(Hash) && target.key?(key)

    target = target[key]
  end
end

operation_ids = document.fetch("paths").values.flat_map do |path_item|
  path_item.map do |method, operation|
    operation["operationId"] if %w[get post put patch delete].include?(method)
  end.compact
end
raise "duplicate operationId" unless operation_ids.uniq.length == operation_ids.length

document.fetch("tags").each do |tag|
  raise "tag missing description: #{tag.fetch("name")}" if tag["description"].to_s.strip.empty?
end

document.fetch("paths").each do |path, path_item|
  path_item.each do |method, operation|
    next unless %w[get post put patch delete].include?(method)

    raise "operation missing description: #{method.upcase} #{path}" if operation["description"].to_s.strip.empty?
  end
end

schemas = document.fetch("components").fetch("schemas")
schemas.each do |schema_name, schema|
  raise "schema missing description: #{schema_name}" if schema["description"].to_s.strip.empty?
  raise "schema missing example: #{schema_name}" unless schema.key?("example")

  schema.fetch("properties", {}).each do |property_name, property|
    raise "schema property missing description: #{schema_name}.#{property_name}" if property["description"].to_s.strip.empty?
  end
end


document.fetch("components").fetch("responses").each do |response_name, response|
  media_type = response.dig("content", "application/problem+json")
  next unless media_type

  examples = media_type["examples"]
  raise "error response missing examples: #{response_name}" unless examples.is_a?(Hash) && !examples.empty?
end


expected_error_codes = %w[
  ARTWORK_IMAGE_DIMENSIONS_INVALID
  ARTWORK_IMAGE_INVALID
  ARTWORK_IMAGE_TOO_LARGE
  ARTWORK_NOT_FOUND
  AUTH_INVALID
  AUTH_REQUIRED
  BACKGROUND_LOCKED
  BACKGROUND_NOT_FOUND
  BACKGROUND_UNAVAILABLE
  INTERNAL_ERROR
  PAGE_INVALID
  POLICY_NOT_FOUND
  POLICY_UNAVAILABLE
  RATE_LIMITED
  REQUEST_INVALID
  REQUEST_REJECTED
  RESOURCE_NOT_FOUND
  SELF_LIKE_NOT_ALLOWED
  STORAGE_UNAVAILABLE
  VALIDATION_FAILED
].sort
documented_error_codes = schemas.fetch("Problem")
  .fetch("properties")
  .fetch("code")
  .fetch("enum")
  .sort
raise "error code catalog mismatch" unless documented_error_codes == expected_error_codes

application_config = File.read("src/main/resources/application.yml")
unless application_config.include?("url: /api/contract/openapi.yaml")
  raise "Swagger UI must load the checked-in OpenAPI contract"
end

pom = File.read("pom.xml")
unless pom.include?("<include>openapi.yaml</include>") && pom.include?("<targetPath>static/contract</targetPath>")
  raise "Maven must package the checked-in OpenAPI contract as a static resource"
end

security_configuration = File.read(
  "src/main/java/tw/gov/taipei/goodmorning/config/SecurityConfiguration.java"
)
unless security_configuration.include?('"/contract/openapi.yaml"')
  raise "Security must allow the static OpenAPI contract"
end

demo_user_filter = File.read(
  "src/main/java/tw/gov/taipei/goodmorning/security/DemoUserFilter.java"
)
unless demo_user_filter.include?('path.equals("/contract/openapi.yaml")')
  raise "Demo user filter must skip the static OpenAPI contract"
end

policy = schemas.fetch("Policy")
%w[startDate endDate].each do |property_name|
  raise "Policy missing required #{property_name}" unless policy.fetch("required").include?(property_name)

  property = policy.fetch("properties").fetch(property_name)
  raise "Policy #{property_name} must use date format" unless property["format"] == "date"
end

puts "OpenAPI checks passed"
puts "paths=#{document.fetch("paths").length} operations=#{operation_ids.length} refs=#{references.uniq.length}"
