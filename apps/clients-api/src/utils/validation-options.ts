import {
  HttpStatus,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipeOptions,
} from '@nestjs/common';

/** Flattens class-validator output into a field -> message map. */
function generateErrors(errors: ValidationError[]): Record<string, unknown> {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        currentValue.children && currentValue.children.length > 0
          ? generateErrors(currentValue.children)
          : Object.values(currentValue.constraints ?? {}).join(', '),
    }),
    {},
  );
}

const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory: (errors: ValidationError[]) =>
    new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: generateErrors(errors),
    }),
};

export default validationOptions;
