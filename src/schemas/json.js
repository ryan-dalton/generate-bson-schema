// NOTE: json is just a subset of bson, so we can just wrap bson here
// Modules
var Type = require('type-of-is')

function typeForJsonSchema (value) {
  var type = Type.string(value).toLowerCase();

  if (type === 'date') {
    return 'string';
  } else if (type === 'null') {
    return 'string';
  }

  return type;
}

// Constants
var DRAFT = "http://json-schema.org/draft-04/schema#"

function getUniqueKeys (a, b, c) {
  var a = Object.keys(a)
  var b = Object.keys(b)
  var c = c || []
  var value
  var cIndex
  var aIndex

  for (var keyIndex = 0, keyLength = b.length; keyIndex < keyLength; keyIndex++) {
    value = b[keyIndex]
    aIndex = a.indexOf(value)
    cIndex = c.indexOf(value)

    if (aIndex === -1) {
      if (cIndex !== -1) {
        // Value is optional, it doesn't exist in A but exists in B(n)
        c.splice(cIndex, 1)
      }
    } else if (cIndex === -1) {
      // Value is required, it exists in both B and A, and is not yet present in C
      c.push(value)
    }
  }

  return c
}

function processArray (array, output, nested) {
  var oneOf
  var type

  if (nested && output) {
    output = {
      items: output
    }
  } else {
    output = output || {}
    output.type = typeForJsonSchema(array)
    output.items = output.items || {}
  }

  // Determine whether each item is different
  for (var index = 0, length = array.length; index < length; index++) {
    var elementType = typeForJsonSchema(array[index])

    if (type && elementType !== type) {
      output.items.oneOf = []
      oneOf = true
      break
    } else {
      type = elementType
    }
  }

  // Setup type otherwise
  if (!oneOf) {
    output.items.type = type
  }

  // Process each item depending
  if (typeof output.items.oneOf !== 'undefined' || type === 'object') {
    for (var index = 0, length = array.length; index < length; index++) {
      var value = array[index]
      var itemType = typeForJsonSchema(value)
      var processOutput

      switch (itemType) {
        case "object":
          processOutput = processObject(value, oneOf ? {} : output.items.properties, true)
          break

        case "array":
          processOutput = processArray(value, oneOf ? {} : output.items.properties, true)
          break

        default:
          processOutput = { type: itemType }
      }

      if (oneOf) {
        output.items.oneOf.push(processOutput)
      } else {
        output.items.properties = processOutput
      }
    }
  }

  return nested ? output.items : output
}

function processObject (object, output, nested) {
  if (nested && output) {
    output = {
      properties: output
    }
  } else {
    output = output || {}
    output.type = typeForJsonSchema(object)
    output.properties = output.properties || {}
  }

  for (var key in object) {
    var value = object[key]
    var type = typeForJsonSchema(value)

    if (type === 'undefined') {
      type = 'null'
    }

    switch (type) {
      case "object":
        output.properties[key] = processObject(value)
        break

      case "array":
        output.properties[key] = processArray(value)
        break

      default:
        output.properties[key] = {
          type: type
        }
    }
  }

  return nested ? output.properties : output
}

module.exports = function (title, object) {
  var processOutput
  var output = {
    $schema: DRAFT
  }

  // Determine title exists
  if (typeof title !== 'string') {
    object = title
    title = undefined
  } else {
    output.title = title
  }

  // Set initial object type
  output.type = typeForJsonSchema(object)

  // Process object
  switch (output.type) {
    case "object":
      processOutput = processObject(object)
      output.type = processOutput.type
      output.properties = processOutput.properties
      break

    case "array":
      processOutput = processArray(object)
      output.type = processOutput.type
      output.items = processOutput.items

      if (output.title) {
        output.items.title = output.title
        output.title += " Set"
      }

      break
  }

  // Output
  return output
}
