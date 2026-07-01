import { parseSchema, validateSchema } from '../schema-runtime'
import schemaText from './schema/fig.kiwi?raw'

const schema = parseSchema(schemaText)
validateSchema(schema)

export default schema
