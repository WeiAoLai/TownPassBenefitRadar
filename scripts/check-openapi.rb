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

policy = document.fetch("components").fetch("schemas").fetch("Policy")
%w[startDate endDate].each do |property_name|
  raise "Policy missing required #{property_name}" unless policy.fetch("required").include?(property_name)

  property = policy.fetch("properties").fetch(property_name)
  raise "Policy #{property_name} must use date format" unless property["format"] == "date"
end

puts "OpenAPI checks passed"
puts "paths=#{document.fetch("paths").length} operations=#{operation_ids.length} refs=#{references.uniq.length}"
